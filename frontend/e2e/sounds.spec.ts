import type { Page } from '@playwright/test';
import { expect, LISA, signIn, test } from './fixtures';
import { stamp } from './wikiHelpers';

/** Counts oscillators created by the synthesised sounds so the test can "hear" them. */
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

test.describe('Notification sounds', () => {
  test('preview plays, the switch silences, and a new chat message rings', async ({
    page,
    browser,
  }) => {
    await spyOnAudio(page);
    await signIn(page);
    await page.goto('/tasks');
    await page.getByRole('button', { name: 'Notifications' }).click();
    const menu = page.getByRole('menu');
    await menu.getByRole('button', { name: /Preview: New chat message/ }).click();
    await expect.poll(() => notes(page)).toBeGreaterThan(0);

    // Lisa writes to Peter while he is on another page: a sound plays by itself.
    await page.keyboard.press('Escape');
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto('/chat');
    await lisa.getByRole('button', { name: 'New message' }).click();
    await lisa.getByRole('dialog').getByRole('checkbox', { name: 'Peter Gabrielle' }).click();
    await lisa.getByRole('dialog').getByRole('button', { name: 'Start conversation' }).click();
    const before = await notes(page);
    const box = lisa.getByRole('textbox', { name: /^Message / });
    await box.fill(`hello ${stamp()}`);
    await box.press('Enter');
    await expect.poll(() => notes(page), { timeout: 20_000 }).toBeGreaterThan(before);

    // With sounds off, the next message is silent.
    await page.getByRole('button', { name: 'Notifications' }).click();
    await page.getByRole('menu').getByRole('switch', { name: 'Sounds' }).click();
    await page.keyboard.press('Escape');
    const silent = await notes(page);
    await box.fill(`again ${stamp()}`);
    await box.press('Enter');
    await page.waitForTimeout(3000);
    expect(await notes(page)).toBe(silent);
    await lisaCtx.close();
  });
});
