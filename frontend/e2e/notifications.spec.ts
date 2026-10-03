import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, LISA, signIn, test } from './fixtures';
import { stamp } from './wikiHelpers';

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
      return (await res.json()) as T;
    },
    [method, path, body ? JSON.stringify(body) : undefined] as const,
  );
}

async function spyOnAudio(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __notes: number }).__notes = 0;
    const proto = window.AudioContext.prototype;
    const original = proto.createOscillator;
    proto.createOscillator = function (this: AudioContext) {
      (window as unknown as { __notes: number }).__notes += 1;
      return original.call(this);
    };
  });
}
const notes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __notes: number }).__notes);

async function board(page: Page) {
  const ws = (await api<{ id: string }[]>(page, 'GET', '/workspaces'))[0]!.id;
  const projects = await api<{ items: { id: string }[] }>(
    page,
    'GET',
    `/workspaces/${ws}/projects?pageSize=5`,
  );
  return { ws, project: projects.items[0]!.id };
}

test.describe('Notifications', () => {
  test('an assignment rings, shows a red count on the bell, and opens the task', async ({
    page,
    browser,
  }) => {
    const title = `Assigned ${stamp()}`;
    await spyOnAudio(page);
    await signIn(page);
    await page.goto('/tasks');
    const me = await api<{ id: string }>(page, 'GET', '/users/me');
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
    // Browsers only play audio after a gesture; any click does it.
    await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible();
    await page.keyboard.press('Shift'); // browsers need a gesture after each page load

    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/tasks');
    const { ws, project } = await board(lisa);
    const before = await notes(page);
    await api(lisa, 'POST', `/workspaces/${ws}/cards`, {
      projectId: project,
      title,
      assigneeIds: [me.id],
    });

    // The bell shows a red count and a sound plays, without any reload.
    const bell = page.getByRole('button', { name: /Notifications, \d+ unread/ });
    await expect(bell).toBeVisible({ timeout: 20_000 });
    await expect(bell.locator('span').filter({ hasText: /^\d+$/ })).toBeVisible();
    await expect.poll(() => notes(page), { timeout: 10_000 }).toBeGreaterThan(before);

    await bell.click();
    const panel = page.getByRole('dialog');
    const item = panel.getByRole('button', { name: new RegExp(`assigned you to .*${title}`) });
    await expect(item).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    await item.click();
    await expect(page.getByRole('dialog').getByText(title).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Notifications, \d+ unread/ })).toHaveCount(0, {
      timeout: 15_000,
    });
    await lisaCtx.close();
  });

  test('a mention in a channel lands in the bell', async ({ page, browser }) => {
    const text = `ping ${stamp()}`;
    await signIn(page);
    await page.goto('/tasks');
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/chat');
    const { ws } = await board(lisa);
    const me = await api<{ id: string; name: string }>(page, 'GET', '/users/me');
    const dm = await api<{ id: string }>(lisa, 'POST', `/workspaces/${ws}/chat/direct`, {
      userIds: [me.id],
    });
    await api(lisa, 'POST', `/chat/channels/${dm.id}/messages`, { body: text });
    const bell = page.getByRole('button', { name: /Notifications, \d+ unread/ });
    await expect(bell).toBeVisible({ timeout: 20_000 });
    await bell.click();
    await expect(
      page
        .getByRole('dialog')
        .getByRole('button', { name: /sent you a message/ })
        .first(),
    ).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.getByRole('button', { name: /Notifications, \d+ unread/ })).toHaveCount(0, {
      timeout: 15_000,
    });
    await lisaCtx.close();
  });
});

test.describe('Task feed event choice', () => {
  test('a feed that takes only new assignments, with a red badge for the person who acted', async ({
    page,
  }) => {
    const name = `assign-${stamp().replace(/\W/g, '').toLowerCase()}`;
    const title = `Feed assign ${stamp()}`;
    await spyOnAudio(page);
    await signIn(page);
    await page.goto('/chat');
    await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible();
    await page.keyboard.press('Shift'); // browsers need a gesture after each page load
    await page.getByRole('button', { name: 'Add channels' }).click();
    await page.getByRole('menuitem', { name: 'Create a channel' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
    await dialog.getByRole('switch', { name: 'Task feed' }).click();
    // Keep only "New assignments".
    for (const label of ['New tasks', 'Moves', 'Edits', 'Deletions', 'Comments']) {
      await dialog.getByRole('checkbox', { name: label }).click();
    }
    await expect(dialog.getByRole('checkbox', { name: 'New assignments' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'New tasks' })).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Create channel' }).click();
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toBeVisible();

    // Leave the channel on screen? No: look at another page so it can announce itself.
    await page.goto('/tasks');
    await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible();
    await page.keyboard.press('Shift'); // browsers need a gesture after each page load
    const me = await api<{ id: string }>(page, 'GET', '/users/me');
    const { ws, project } = await board(page);
    const card = await api<{ id: string; version: number }>(
      page,
      'POST',
      `/workspaces/${ws}/cards`,
      {
        projectId: project,
        title,
      },
    );
    await api(page, 'POST', `/cards/${card.id}/move`, {
      version: card.version,
      status: 'in_progress',
    });
    // Created and moved are not taken: this channel stays empty (other feeds may ring, so the
    // sound is only checked after the assignment).
    await page.waitForTimeout(2000);
    const channels = await api<{ id: string; name: string }[]>(
      page,
      'GET',
      `/workspaces/${ws}/chat/channels`,
    );
    const mine = channels.find((c) => c.name === name)!;
    const quiet = await api<{ messages: unknown[] }>(
      page,
      'GET',
      `/chat/channels/${mine.id}/messages`,
    );
    expect(quiet.messages).toHaveLength(0);
    const afterMoves = await notes(page);
    const cur = await api<{ version: number }>(page, 'GET', `/cards/${card.id}`);
    await api(page, 'PATCH', `/cards/${card.id}`, { version: cur.version, assigneeIds: [me.id] });

    // The acting person's own change counts: red badge in the chat navigation, a sound, one card.
    await expect(page.getByRole('status', { name: /unread/ }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(() => notes(page), { timeout: 10_000 }).toBeGreaterThan(afterMoves);
    await page.goto('/chat');
    const row = page.getByRole('link', { name: new RegExp(name) });
    await expect(row.getByLabel(/unread messages?/)).toBeVisible();
    await row.click();
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText('Assigned', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('New task')).toHaveCount(0);
    await expect(page.getByText('Moved')).toHaveCount(0);
  });
});
