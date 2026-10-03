import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures';
import { stamp } from './wikiHelpers';

// Needs the stand-in Google (e2e/support/fakeGoogle.mjs) and a backend started against it.
test.skip(!process.env.E2E_FAKE_GOOGLE, 'set E2E_FAKE_GOOGLE=1 with the fake Google running');

const FAKE = process.env.E2E_FAKE_GOOGLE_URL ?? 'http://localhost:47190';
const PETER = 'peter@demo.lecodekanban.test';
const LISA_MAIL = 'lisa@demo.lecodekanban.test';

async function calendar(
  page: Page,
  events: { id: string; title: string; inMinutes: number; attendees?: string[] }[],
) {
  const res = await page.request.post(`${FAKE}/__events`, { data: events });
  expect(res.ok()).toBeTruthy();
}

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

test.describe('Google Calendar integration', () => {
  test('connect, announce the next meeting, remind before it starts, pause and disconnect', async ({
    page,
  }) => {
    const channel = `cal-${stamp().replace(/\W/g, '').toLowerCase()}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/integrations');
    const ws = (await api<{ id: string }[]>(page, 'GET', '/workspaces'))[0]!.id;
    // Start clean: an earlier run may have left the connection behind.
    await api(page, 'DELETE', `/workspaces/${ws}/integrations/google_calendar`);
    await calendar(page, [
      { id: 'planning', title: 'Sprint planning', inMinutes: 180, attendees: [PETER, LISA_MAIL] },
    ]);
    await page.reload();

    await expect(page.getByText('Not connected').first()).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    // Connect: Google approves at once and sends the browser back.
    await page.getByRole('button', { name: 'Connect Google Calendar' }).click();
    await expect(page.getByText('Google Calendar connected')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Connected as peter@gmail.test')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Active' })).toBeChecked();
    await expect(page.getByRole('list').getByText('Sprint planning')).toBeVisible();

    // The sidebar card announces the next meeting with its participants and a Join link.
    const announce = page.getByRole('region', { name: 'Next meeting' });
    await expect(announce).toContainText('Sprint planning');
    await expect(announce).toContainText('Announcement!');
    await expect(announce.getByRole('link', { name: 'Join Now' })).toHaveAttribute(
      'href',
      'https://meet.test/planning',
    );
    await expect(announce).toContainText('Participants:');

    // A meeting comes within the lead time while the app is open: pop-up, bell count, and a channel post.
    await api(page, 'POST', `/workspaces/${ws}/chat/channels`, { name: channel });
    await page.reload();
    await page.getByRole('combobox', { name: 'Also post in a channel' }).click();
    await page.getByRole('option', { name: channel }).click();
    await calendar(page, [
      { id: 'planning', title: 'Sprint planning', inMinutes: 180 },
      { id: 'standup', title: 'Team stand-up', inMinutes: 20, attendees: [PETER, LISA_MAIL] },
    ]);
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByText('Meeting soon')).toBeVisible({ timeout: 20_000 });
    await expect(announce).toContainText('Team stand-up');
    await expect(announce).toContainText(/Starts in \d+ min/);
    const bell = page.getByRole('button', { name: /Notifications, \d+ unread/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Team stand-up.*starts at/ }),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // The same reminder is in the channel, with a Join link.
    const channels = await api<{ id: string; name: string }[]>(
      page,
      'GET',
      `/workspaces/${ws}/chat/channels`,
    );
    const mine = channels.find((c) => c.name === channel)!;
    await page.goto(`/chat/${mine.id}`);
    await expect(page.getByText('Team stand-up')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Join' }).first()).toHaveAttribute(
      'href',
      'https://meet.test/standup',
    );
    await page.goto('/integrations');

    // Pausing silences the card; resuming brings it back.
    await page.getByRole('switch', { name: 'Active' }).click();
    await expect(page.getByText('Paused').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Next meeting' })).toHaveCount(0);
    await page.getByRole('switch', { name: 'Active' }).click();
    await expect(page.getByRole('region', { name: 'Next meeting' })).toBeVisible();

    // The lead time is a choice.
    await page.getByRole('combobox', { name: 'Remind me' }).click();
    await page.getByRole('option', { name: '10 min before' }).click();
    await expect(page.getByRole('combobox', { name: 'Remind me' })).toContainText('10 min before');

    // Disconnecting forgets everything.
    await page.getByRole('button', { name: 'Disconnect' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).click();
    await expect(page.getByText('Not connected').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Next meeting' })).toContainText(
      'See your meetings here',
    );
  });
});
