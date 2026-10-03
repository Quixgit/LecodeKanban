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
    await page.getByRole('menuitem', { name: 'Celebrate' }).click();
    await expect(page.getByRole('button', { name: /Celebrate, 1/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(lisa.getByRole('button', { name: /Celebrate, 1/ }).first()).toBeVisible({
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

    // The card's chat tab.
    await openKanban(page);
    await page.goto(`/tasks?projectId=${project.id}`);
    await page.locator('article').first().click();
    const drawer = page.getByRole('dialog');
    await drawer.getByRole('radio', { name: 'Chat' }).click();
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
