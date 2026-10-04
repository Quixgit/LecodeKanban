import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, LISA, openKanban, signIn, test } from './fixtures';
import { PNG, stamp } from './wikiHelpers';

const slug = () => `e2e-${stamp().toLowerCase()}`;

async function createChannel(page: Page, name: string) {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'Add channels' }).click();
  await page.getByRole('menuitem', { name: 'Create a channel' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
  await dialog.getByRole('button', { name: 'Create channel' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function send(page: Page, label: RegExp | string, text: string) {
  const box = page.getByRole('textbox', { name: label });
  await box.fill(text);
  await box.press('Enter');
}

const message = (page: Page, text: string) =>
  page.getByRole('listitem').filter({ hasText: text }).first();

test.describe('Chat', () => {
  test('channel: post, join, reply in a thread, react, edit, delete', async ({ page, browser }) => {
    const name = slug();
    await signIn(page);
    await createChannel(page, name);
    await send(page, /^Message #/, 'Hello team');
    await expect(message(page, 'Hello team')).toBeVisible();

    // Lisa finds the channel in the directory, joins it and sees the message.
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/chat');
    await lisa.getByRole('button', { name: 'Add channels' }).click();
    await lisa.getByRole('menuitem', { name: 'Browse channels' }).click();
    const browse = lisa.getByRole('dialog');
    await browse.getByRole('textbox', { name: 'Search channels' }).fill(name);
    await browse.getByRole('button', { name: 'Join' }).click();
    await expect(lisa.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(message(lisa, 'Hello team')).toBeVisible();

    // A reply in a thread shows up for Peter without a reload.
    await message(lisa, 'Hello team').hover();
    await lisa.getByRole('button', { name: 'Reply in thread' }).first().click();
    await send(lisa, 'Reply in thread', 'Hi from Lisa');
    await expect(
      lisa.getByRole('region', { name: 'Thread' }).getByText('Hi from Lisa'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /1 reply/ })).toBeVisible({ timeout: 15_000 });

    // Peter reacts; Lisa sees the chip (live).
    await message(page, 'Hello team').hover();
    await page.getByRole('button', { name: 'Add reaction' }).first().click();
    await page.getByRole('button', { name: '🎉' }).first().click();
    await expect(page.getByRole('button', { name: /🎉, 1/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(lisa.getByRole('button', { name: /🎉, 1/ }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Edit and delete one's own message.
    await message(page, 'Hello team').hover();
    await page.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Edit message' }).click();
    const edit = page.getByRole('textbox', { name: 'Edit message' });
    await edit.fill('Hello again, team');
    await edit.press('Enter');
    await expect(message(page, 'Hello again, team')).toContainText('(edited)');
    await expect(message(lisa, 'Hello again, team')).toBeVisible({ timeout: 15_000 });

    await message(page, 'Hello again, team').hover();
    await page.getByRole('button', { name: 'More actions' }).first().click();
    await page.getByRole('menuitem', { name: 'Delete message' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete message' }).click();
    await expect(page.getByText('This message was deleted.')).toBeVisible();
    await lisaCtx.close();
  });

  test('direct message: unread badge in the sidebar and the nav, cleared on open', async ({
    page,
    browser,
  }) => {
    const text = `ping ${stamp()}`;
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/tasks'); // somewhere else in the app

    await signIn(page);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'New message' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: 'Lisa Kim' }).click();
    await dialog.getByRole('button', { name: 'Start conversation' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Lisa Kim/ })).toBeVisible();
    await send(page, /^Message /, text);
    await expect(message(page, text)).toBeVisible();

    // Lisa is on another page: the Chat item in the main menu shows an unread badge.
    const nav = lisa.getByRole('link', { name: /^Chat/ });
    await expect(nav.getByRole('status')).toBeVisible({ timeout: 15_000 });

    await nav.click();
    await lisa.getByRole('link', { name: /Peter/ }).first().click();
    await expect(message(lisa, text)).toBeVisible();
    await expect(nav.getByRole('status')).toHaveCount(0, { timeout: 15_000 });
    await lisaCtx.close();
  });

  test('is accessible and keeps the Slack-style keyboard flow', async ({ page }) => {
    const name = slug();
    await signIn(page);
    await createChannel(page, name);
    const box = page.getByRole('textbox', { name: /^Message #/ });
    await box.fill('line one');
    await box.press('Shift+Enter');
    await box.pressSequentially('line two');
    await box.press('Enter');
    await expect(message(page, 'line two')).toBeVisible();
    await message(page, 'line two').hover();
    await page.getByRole('button', { name: 'Reply in thread' }).first().click();
    await expect(page.getByRole('region', { name: 'Thread' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    await page.getByRole('button', { name: 'Channel details' }).click();
    const dialogResults = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(dialogResults.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});

test.describe('Chat in the Kanban', () => {
  test('a card has a chat tab and its project has a chat drawer, with live unread badges', async ({
    page,
    browser,
  }) => {
    const text = `card note ${stamp()}`;
    await signIn(page);
    const workspaces = (await (await page.request.get('/api/v1/workspaces')).json()) as {
      id: string;
    }[];
    const ws = workspaces[0]!.id;
    const projects = (await (
      await page.request.get(`/api/v1/workspaces/${ws}/projects?pageSize=5`)
    ).json()) as {
      items: { id: string; name: string }[];
    };
    const project = projects.items[0]!;

    // The card's conversation (the Comments tab).
    await openKanban(page);
    await page.goto(`/tasks?projectId=${project.id}`);
    await page.locator('article').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('radio', { name: 'Comments' })).toBeChecked();
    const box = drawer.getByRole('textbox', { name: 'Write a message' });
    await box.fill(text);
    await box.press('Enter');
    await expect(drawer.getByRole('listitem').filter({ hasText: text })).toBeVisible();
    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The project chat: Lisa writes, Peter sees the badge on the toolbar button without reloading.
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await openKanban(lisa);
    await lisa.goto(`/tasks?projectId=${project.id}`);
    await lisa.getByRole('button', { name: 'Project chat' }).click();
    const lbox = lisa.getByRole('dialog').getByRole('textbox', { name: 'Write a message' });
    const hello = `board note ${stamp()}`;
    await lbox.fill(hello);
    await lbox.press('Enter');
    await expect(lisa.getByRole('dialog').getByText(hello)).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Project chat' }).locator('..').getByRole('status'),
    ).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Project chat' }).click();
    await expect(page.getByRole('dialog').getByText(hello)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Project chat' }).locator('..').getByRole('status'),
    ).toHaveCount(0, {
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    await lisaCtx.close();
  });
});

test.describe('Chat extras', () => {
  test('attachments, pins, saved, starred, threads view and search', async ({ page, browser }) => {
    const name = slug();
    const note = `release note ${stamp()}`;
    await signIn(page);
    await createChannel(page, name);

    // Attach an image and a document by file picker and send them with a message.
    await page.locator('input[type=file]').setInputFiles([
      { name: 'diagram.png', mimeType: 'image/png', buffer: PNG },
      { name: 'plan.txt', mimeType: 'text/plain', buffer: Buffer.from('rollout plan') },
    ]);
    await expect(page.getByText('plan.txt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled({
      timeout: 15_000,
    });
    const box = page.getByRole('textbox', { name: /^Message #/ });
    await box.fill(note);
    await box.press('Enter');
    const item = message(page, note);
    await expect(item.locator('img[alt="diagram.png"]')).toBeVisible();
    await expect(item.getByText('plan.txt')).toBeVisible();

    // Pin and save the message; the tabs and the Saved page show it.
    await item.hover();
    await item.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Pin to channel' }).click();
    await expect(page.getByRole('tab', { name: /Pins \(1\)/ })).toBeVisible();
    await item.hover();
    await item.getByRole('button', { name: 'Save for later' }).click();
    await expect(item.getByRole('img', { name: 'Saved' })).toBeVisible();
    await page.getByRole('tab', { name: /Pins/ }).click();
    await expect(message(page, note)).toBeVisible();
    await page.getByRole('tab', { name: 'Files' }).click();
    await expect(page.getByText('plan.txt')).toBeVisible();
    await page.getByRole('tab', { name: 'Messages' }).click();

    // Star the channel: it moves to the Starred section.
    await page.getByRole('button', { name: 'Star this conversation' }).click();
    await expect(page.getByRole('button', { name: 'Starred' })).toBeVisible();

    // Search finds the message, Saved lists it.
    await page
      .getByRole('button', { name: /Search messages/ })
      .first()
      .click();
    const search = page.getByRole('dialog');
    await search.getByRole('textbox', { name: 'Search messages' }).fill(note.slice(0, 18));
    await expect(search.getByRole('button', { name: new RegExp(note) })).toBeVisible({
      timeout: 15_000,
    });
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Saved' }).click();
    await expect(page.getByRole('link', { name: new RegExp(note) })).toBeVisible();

    // A second person replies in a thread and sees "typing" and @channel highlighting.
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto(page.url().replace(/\/chat\/saved$/, ''));
    await lisa.goto('/chat');
    await lisa.getByRole('button', { name: 'Add channels' }).click();
    await lisa.getByRole('menuitem', { name: 'Browse channels' }).click();
    await lisa.getByRole('dialog').getByRole('textbox', { name: 'Search channels' }).fill(name);
    await lisa.getByRole('dialog').getByRole('button', { name: 'Join' }).click();
    await expect(message(lisa, note)).toBeVisible();
    await message(lisa, note).hover();
    await message(lisa, note).getByRole('button', { name: 'Reply in thread' }).click();
    await send(lisa, 'Reply in thread', 'On it');
    await page.getByRole('link', { name: 'Threads' }).click();
    await expect(page.getByRole('link', { name: new RegExp(note) })).toBeVisible({
      timeout: 15_000,
    });
    await lisaCtx.close();
  });
});

test.describe('Chat live signals', () => {
  test('shows who is online and who is typing', async ({ page, browser }) => {
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/chat'); // the app shell sends a heartbeat

    await signIn(page);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'New message' }).click();
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Lisa Kim' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Start conversation' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Lisa Kim/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('img', { name: 'Online' }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Lisa opens the same conversation and types; Peter sees the indicator.
    await lisa.goto('/chat');
    await lisa.getByRole('link', { name: /Peter/ }).first().click();
    const box = lisa.getByRole('textbox', { name: /^Message / });
    await box.click();
    await box.pressSequentially('hel');
    await expect(page.getByRole('status').filter({ hasText: 'Lisa is typing' })).toBeVisible({
      timeout: 15_000,
    });
    await lisaCtx.close();
  });
});

test.describe('Chat search, emoji and invitations', () => {
  test('creates a channel with people already in it', async ({ page, browser }) => {
    const name = slug();
    await signIn(page);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'Add channels' }).click();
    await page.getByRole('menuitem', { name: 'Create a channel' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
    await dialog.getByRole('checkbox', { name: 'Lisa Kim' }).click();
    await expect(dialog.getByRole('button', { name: /Don’t add Lisa Kim/ })).toBeVisible();
    await dialog.getByRole('button', { name: 'Create channel' }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show members' })).toContainText('2');

    // Lisa finds it in her list without joining.
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/chat');
    await expect(lisa.getByRole('link', { name })).toBeVisible();
    await lisaCtx.close();
  });

  test('inserts emoji from the picker and reacts with any emoji', async ({ page }) => {
    const name = slug();
    await signIn(page);
    await createChannel(page, name);
    const box = page.getByRole('textbox', { name: /^Message #/ });
    await box.fill('great job ');
    await page.getByRole('button', { name: 'Add an emoji' }).click();
    await page.getByRole('textbox', { name: 'Search emoji' }).fill('rocket');
    await page.getByRole('button', { name: 'rocket' }).first().click();
    await expect(box).toHaveValue(/great job .*🚀/);
    await box.press('Enter');
    const item = message(page, 'great job');
    await expect(item).toContainText('🚀');

    await item.hover();
    await item.getByRole('button', { name: 'Add reaction' }).first().click();
    await page.getByRole('textbox', { name: 'Search emoji' }).fill('party');
    await page
      .getByRole('button', { name: /party popper|partying/i })
      .first()
      .click();
    await expect(item.getByRole('button', { name: /, 1$/ }).first()).toBeVisible();
    await item.hover();
    await item.getByRole('button', { name: 'Add reaction' }).first().click();
    await page.getByRole('button', { name: '👍' }).first().click();
    await expect(item.getByRole('button', { name: '👍, 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('one search with modifiers, chips and jump-to', async ({ page }) => {
    const name = slug();
    const word = `zebra${stamp().toLowerCase()}`;
    await signIn(page);
    await createChannel(page, name);
    const box = page.getByRole('textbox', { name: /^Message #/ });
    await box.fill(`${word} first https://example.com/a`);
    await box.press('Enter');
    await box.fill(`${word} second`);
    await box.press('Enter');
    await expect(message(page, `${word} second`)).toBeVisible();

    // One entry point only: the sidebar button (no second search icon in the header).
    await expect(page.getByRole('button', { name: /Search messages/ })).toHaveCount(1);
    await page.getByRole('button', { name: /Search messages/ }).click();
    const dialog = page.getByRole('dialog');
    const input = dialog.getByRole('textbox', { name: /Search messages/ });
    await input.fill(word);
    await expect(dialog.getByRole('button', { name: new RegExp(`${word} first`) })).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog.getByRole('button', { name: new RegExp(`${word} second`) })).toBeVisible();

    // The "Has a link" chip narrows to the first message.
    await dialog.getByRole('button', { name: 'Has a link' }).click();
    await expect(dialog.getByRole('button', { name: new RegExp(`${word} second`) })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: new RegExp(`${word} first`) })).toBeVisible();

    // Typed modifiers become chips: in:#channel offers suggestions.
    await dialog.getByRole('button', { name: 'Clear' }).click();
    await input.fill(`${word} in:${name}`);
    await dialog.getByRole('option').first().click();
    await expect(dialog.getByRole('button', { name: /Remove filter in:/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: new RegExp(`${word} second`) })).toBeVisible({
      timeout: 15_000,
    });

    // Jump-to: the channel itself is offered for its name.
    await dialog.getByRole('button', { name: 'Clear' }).click();
    await input.fill(name);
    await dialog.getByRole('button', { name }).first().click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });
});

/** Calls the API from the page, with its session and CSRF cookie, to create board data. */
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
    [method, path, body ? JSON.stringify(body) : ''] as const,
  );
}

test.describe('Task feed channel', () => {
  test('a channel that only receives task updates, and lights up when one arrives', async ({
    page,
    browser,
  }) => {
    const name = slug();
    const title = `Feed task ${stamp()}`;
    await signIn(page);
    await page.goto('/chat');
    await page.getByRole('button', { name: 'Add channels' }).click();
    await page.getByRole('menuitem', { name: 'Create a channel' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
    await dialog.getByRole('switch', { name: 'Task feed' }).click();
    await expect(dialog.getByRole('combobox', { name: 'Project' })).toBeVisible();
    await dialog.getByRole('checkbox', { name: 'Lisa Kim' }).click();
    await dialog.getByRole('button', { name: 'Create channel' }).click();
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(name) })).toContainText(
      'Task feed',
    );
    await expect(page.getByText('Only task updates appear here')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Message/ })).toHaveCount(0);

    // Lisa is on the Tasks page while a task is created and moved.
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/chat');
    const row = lisa.getByRole('link', { name: new RegExp(name) });
    await expect(row).toBeVisible();

    const ws = ((await api<{ id: string }[]>(page, 'GET', '/workspaces')) as { id: string }[])[0]!
      .id;
    const projects = await api<{ items: { id: string; key: string }[] }>(
      page,
      'GET',
      `/workspaces/${ws}/projects?pageSize=5`,
    );
    const project = projects.items[0]!;
    const card = await api<{ id: string; version: number }>(
      page,
      'POST',
      `/workspaces/${ws}/cards`,
      {
        projectId: project.id,
        title,
      },
    );
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('New task').first()).toBeVisible();
    await api(page, 'POST', `/cards/${card.id}/move`, {
      version: card.version,
      status: 'in_progress',
    });
    await expect(page.getByText('Moved')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Open task' }).first()).toBeVisible();

    // The channel announces itself in Lisa's list: unread count and a highlighted row.
    await expect(row.getByLabel(/unread messages?/)).toBeVisible({ timeout: 15_000 });
    await row.click();
    await expect(lisa.getByText(title).first()).toBeVisible();
    await expect(row.getByLabel(/unread messages?/)).toHaveCount(0, { timeout: 15_000 });

    // Switching the feed off turns it back into an ordinary channel.
    await page.getByRole('button', { name: 'Channel details' }).click();
    await page.getByRole('dialog').getByRole('switch', { name: 'Send task updates here' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: /^Message #/ })).toBeVisible({
      timeout: 15_000,
    });
    await lisaCtx.close();
  });
});

test.describe('Status', () => {
  test('sets a status that others see, and do-not-disturb silences sounds', async ({
    page,
    browser,
  }) => {
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await lisa.addInitScript(() => {
      (window as unknown as { __notes: number }).__notes = 0;
      const proto = window.AudioContext.prototype;
      const original = proto.createOscillator;
      proto.createOscillator = function (this: AudioContext) {
        (window as unknown as { __notes: number }).__notes += 1;
        return original.call(this);
      };
    });
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/chat');
    await lisa.getByRole('button', { name: 'New message' }).click();
    await lisa.getByRole('dialog').getByRole('checkbox', { name: 'Peter Gabrielle' }).click();
    await lisa.getByRole('dialog').getByRole('button', { name: 'Start conversation' }).click();
    await expect(lisa.getByRole('heading', { level: 1, name: /Peter/ })).toBeVisible();

    // Peter picks "In a meeting" from the user menu.
    await signIn(page);
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Set a status' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'In a meeting' }).click();
    await expect(dialog.getByRole('textbox', { name: 'What’s your status?' })).toHaveValue(
      'In a meeting',
    );
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Lisa sees the status next to Peter's name without reloading.
    await expect(lisa.getByRole('img', { name: 'In a meeting' }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(lisa.getByRole('img', { name: 'Busy' }).first()).toBeVisible();

    // Peter switches to do-not-disturb; a message from Lisa makes no sound for him.
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Set a status' }).click();
    await page
      .getByRole('dialog')
      .getByRole('radio', { name: /Do not disturb/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      (window as unknown as { __notes: number }).__notes = 0;
    });
    const box = lisa.getByRole('textbox', { name: /^Message / });
    await box.fill(`quiet ${stamp()}`);
    await box.press('Enter');
    await page.waitForTimeout(3500);
    expect(
      await page.evaluate(() => (window as unknown as { __notes?: number }).__notes ?? 0),
    ).toBe(0);

    // Clearing removes it.
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Set a status' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Clear status' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await lisaCtx.close();
  });

  test('channel context menu: copy, star, notification levels, leave', async ({
    page,
    context,
  }) => {
    const name = slug();
    await signIn(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await createChannel(page, name);
    const row = page.getByRole('link', { name: new RegExp(name) });

    // Copy link puts the channel address on the clipboard.
    await row.click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Channel details' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'More options' })).toBeVisible();
    const a11y = await new AxeBuilder({ page }).include('[role="menu"]').analyze();
    expect(a11y.violations).toEqual([]);
    await menu.getByRole('menuitem', { name: 'Copy' }).click();
    await page.getByRole('menuitem', { name: 'Copy link' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
      /\/chat\/[0-9a-f-]{36}$/,
    );

    // Star moves it to the Starred section.
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Star channel' }).click();
    await expect(page.getByRole('button', { name: 'Starred' })).toBeVisible();
    await row.click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: 'Remove star' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Remove star' }).click();

    // Channel details opens the details dialog.
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Channel details' }).click();
    await page.getByRole('menuitem', { name: 'About this channel' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Just mentions keeps it in place; mute and hide moves it to the Muted section.
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Notify you about…' }).click();
    await page.getByRole('menuitemradio', { name: /Just mentions/ }).click();
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Notify you about…' }).click();
    await expect(page.getByRole('menuitemradio', { name: /Just mentions/ })).toBeChecked();
    await page.getByRole('menuitemradio', { name: /Mute and hide/ }).click();
    await expect(page.getByRole('button', { name: 'Muted' })).toBeVisible();
    await expect(row).toHaveCount(0);
    await page.getByRole('button', { name: 'Muted' }).click();
    await expect(row).toBeVisible();

    // Back to all messages, then leave with confirmation.
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Notify you about…' }).click();
    await page.getByRole('menuitemradio', { name: /All new posts/ }).click();
    await expect(page.getByRole('button', { name: 'Muted' })).toHaveCount(0);
    await row.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Leave channel' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave channel' }).click();
    await expect(row).toHaveCount(0);
  });
});
