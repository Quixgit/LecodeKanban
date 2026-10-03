import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, LISA, signIn, test } from './fixtures';
import { stamp } from './wikiHelpers';

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
