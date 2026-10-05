import { createHmac } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures';
import { stamp } from './wikiHelpers';

// Needs the stand-in GitHub (e2e/support/fakeGitHub.mjs) and a backend started with LK_GITHUB_API_URL.
test.skip(!process.env.E2E_FAKE_GITHUB, 'set E2E_FAKE_GITHUB=1 with the fake GitHub running');

const FAKE = process.env.E2E_FAKE_GITHUB_URL ?? 'http://localhost:47191';
const TOKEN = 'ghp_' + 'a1b2c3d4e5'.repeat(4);

type State = {
  hooks: { id: number; repo: string; url: string; secret: string }[];
  issues: { repo: string; number: number; title: string; body: string }[];
  states: { repo: string; number: number; state: string }[];
  comments: { repo: string; number: number; body: string }[];
};
const fake = async (page: Page) =>
  (await (await page.request.get(`${FAKE}/__state`)).json()) as State;

/** Calls the API from the page, with its session and CSRF cookie. */
async function api<T>(page: Page, method: string, path: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ([m, p, b]) => {
      const csrf = decodeURIComponent(
        document.cookie
          .split('; ')
          .find((c) => c.startsWith('lk_csrf='))
          ?.slice(8) ?? '',
      );
      const res = await fetch(`/api/v1${p as string}`, {
        method: m as string,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: b ? (b as string) : undefined,
      });
      return (res.status === 204 ? undefined : await res.json()) as T;
    },
    [method, path, body ? JSON.stringify(body) : undefined] as const,
  );
}

/** Sends GitHub's signed webhook to the app, the way GitHub would. */
async function deliver(page: Page, secret: string, event: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  const res = await page.request.post('/api/v1/integrations/github/webhook', {
    data: body,
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': event,
      'X-GitHub-Delivery': `e2e-${stamp()}-${Math.random()}`,
      'X-Hub-Signature-256': sig,
    },
  });
  return res.status();
}

const prPayload = (
  action: string,
  number: number,
  title: string,
  state: string,
  merged: boolean,
) => ({
  action,
  repository: { full_name: 'acme/web' },
  pull_request: {
    number,
    title,
    body: '',
    html_url: `https://github.test/acme/web/pull/${number}`,
    state,
    merged,
    draft: false,
    user: { login: 'dev' },
    head: { ref: 'feature/x' },
  },
});

test.describe('GitHub integration', () => {
  test('connect, link a project, pull requests move tasks, tasks reach GitHub, disconnect', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/integrations');
    const ws = (await api<{ id: string }[]>(page, 'GET', '/workspaces'))[0]!.id;
    // Start clean: an earlier run may have left the connection behind.
    await api(page, 'DELETE', `/workspaces/${ws}/github`);
    await page.request.post(`${FAKE}/__reset`);
    await page.reload();

    const tile = page.locator('[data-provider="github"]');
    await expect(tile).toContainText('Not connected');
    await tile.getByRole('link', { name: 'GitHub' }).click();
    await expect(page).toHaveURL(/\/integrations\/github$/);
    const drawer = page.getByRole('main');
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    // A rejected token says so; a good one connects.
    await drawer.getByLabel('Access token').fill('ghp_' + 'x'.repeat(10));
    await expect(drawer.getByRole('button', { name: 'Connect GitHub' })).toBeDisabled();
    await drawer.getByLabel('Access token').fill('nope_' + 'z'.repeat(30));
    await drawer.getByRole('button', { name: 'Connect GitHub' }).click();
    await expect(drawer.getByText(/didn.t accept that token/)).toBeVisible();
    await drawer.getByLabel('Access token').fill(TOKEN);
    await drawer.getByRole('button', { name: 'Connect GitHub' }).click();
    await expect(drawer.getByText('Connected as @octo-admin')).toBeVisible({ timeout: 15_000 });

    // Link a project to a repository: the webhook is registered on GitHub.
    const projects = await api<{ items: { id: string; key: string; name: string }[] }>(
      page,
      'GET',
      `/workspaces/${ws}/projects?pageSize=50`,
    );
    const project = projects.items[0]!;
    await api(
      page,
      'DELETE',
      `/workspaces/${ws}/github/repos/00000000-0000-0000-0000-000000000000`,
    );
    await drawer.getByRole('combobox', { name: 'Project' }).click();
    await page.getByRole('option', { name: new RegExp(`^${project.key} ·`) }).click();
    await drawer.getByRole('combobox', { name: 'Repository' }).click();
    await page.getByRole('option', { name: 'acme/web' }).click();
    await drawer.getByRole('button', { name: 'Link', exact: true }).click();
    await expect(drawer.getByText('acme/web').first()).toBeVisible({ timeout: 15_000 });
    const hook = (await fake(page)).hooks[0]!;
    expect(hook.repo).toBe('acme/web');
    expect(hook.url).toContain('/api/v1/integrations/github/webhook');

    // The rules are switches.
    await drawer.getByRole('switch', { name: 'Comment when a task moves' }).click();
    await expect(
      drawer.getByRole('switch', { name: 'Comment when a task moves' }),
    ).not.toBeChecked();
    await drawer.getByRole('switch', { name: 'Comment when a task moves' }).click();
    await page.keyboard.press('Escape');

    // A forged delivery is refused; a signed one that mentions a task links it and moves it to In review.
    const title = `GitHub task ${stamp()}`;
    const card = await api<{ id: string; key: string; version: number }>(
      page,
      'POST',
      `/workspaces/${ws}/cards`,
      {
        projectId: project.id,
        title,
      },
    );
    expect(
      (
        await page.request.post('/api/v1/integrations/github/webhook', {
          data: '{"repository":{"full_name":"acme/web"}}',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Event': 'pull_request',
            'X-Hub-Signature-256': 'sha256=00',
          },
        })
      ).status(),
    ).toBe(401);
    expect(
      await deliver(
        page,
        hook.secret,
        'pull_request',
        prPayload('opened', 21, `${card.key}: speed up`, 'open', false),
      ),
    ).toBe(204);
    await page.goto(`/tasks?card=${card.id}`);
    const panel = page
      .getByRole('dialog')
      .getByRole('region', { name: 'GitHub' })
      .or(page.getByRole('dialog').locator('section', { hasText: 'GitHub' }));
    await expect(panel.getByText('speed up')).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByText('Open', { exact: true })).toBeVisible();
    expect((await api<{ status: string }>(page, 'GET', `/cards/${card.id}`)).status).toBe(
      'in_review',
    );

    // Merging finishes the task, live in the open window, without anything being sent back to GitHub.
    expect(
      await deliver(
        page,
        hook.secret,
        'pull_request',
        prPayload('closed', 21, `${card.key}: speed up`, 'closed', true),
      ),
    ).toBe(204);
    await expect(panel.getByText('Merged', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect((await api<{ status: string }>(page, 'GET', `/cards/${card.id}`)).status).toBe('done');
    expect((await fake(page)).comments).toHaveLength(0);

    // The task window offers a branch name and an issue; the issue is created on GitHub and linked.
    await page.getByRole('button', { name: 'Copy the suggested branch name' }).click();
    await page.getByRole('button', { name: 'Create GitHub issue' }).click();
    await expect(panel.getByText(`${card.key} ${title}`)).toBeVisible({ timeout: 15_000 });
    const issue = (await fake(page)).issues[0]!;
    expect(issue.repo).toBe('acme/web');
    expect(issue.body).toContain('lk:card=' + card.id);

    // The issue follows the task: moving it back out of Done and into Done again closes it, and so on.
    const move = async (status: string) =>
      api(page, 'POST', `/cards/${card.id}/move`, {
        version: (await api<{ version: number }>(page, 'GET', `/cards/${card.id}`)).version,
        status,
      });
    await move('in_progress');
    await move('done');
    await expect
      .poll(async () => (await fake(page)).states.map((s) => s.state))
      .toEqual(['closed']);
    await move('in_progress');
    await expect
      .poll(async () => (await fake(page)).states.map((s) => s.state))
      .toEqual(['closed', 'open']);

    // An issue opened on GitHub becomes a task.
    const issueTitle = `Issue from GitHub ${stamp()}`;
    expect(
      await deliver(page, hook.secret, 'issues', {
        action: 'opened',
        repository: { full_name: 'acme/web' },
        issue: {
          number: 77,
          title: issueTitle,
          body: 'It crashes',
          state: 'open',
          html_url: 'https://github.test/acme/web/issues/77',
          user: { login: 'dev' },
        },
      }),
    ).toBe(204);
    const found = await api<{ items: { title: string }[] }>(
      page,
      'GET',
      `/workspaces/${ws}/cards?projectId=${project.id}&search=${encodeURIComponent('Issue from GitHub')}&pageSize=20`,
    );
    expect(found.items.some((c) => c.title === issueTitle)).toBeTruthy();

    // Disconnecting removes the webhook.
    await page.goto('/integrations');
    await page.locator('[data-provider="github"]').getByRole('link', { name: 'GitHub' }).click();
    await page.getByRole('button', { name: 'Disconnect' }).click();
    await page
      .getByRole('group', { name: 'Disconnect GitHub?' })
      .getByRole('button', { name: 'Yes, disconnect' })
      .click();
    await expect(page.getByRole('main').getByText('Connected as')).toHaveCount(0, {
      timeout: 15_000,
    });
    expect((await fake(page)).hooks).toHaveLength(0);
  });
});
