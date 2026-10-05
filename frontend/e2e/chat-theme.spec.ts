import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

test.describe('Chat appearance', () => {
  test('pick a theme, set own colours, reset; stays after reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/chat');
    const side = page.locator('aside[aria-label="Chat"]');
    await page.getByRole('button', { name: 'Chat appearance' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Aubergine' }).click();
    // The sidebar turns dark at once, with light text.
    await expect(side).toHaveCSS('background-color', 'rgb(63, 14, 64)');
    await dialog.getByRole('button', { name: 'Done' }).click();

    await page.waitForTimeout(500);
    for (const name of ['Aubergine']) {
      const axe = await new AxeBuilder({ page })
        .include('main')
        .include('aside[aria-label="Chat"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(axe.violations.map((v) => `${name} ${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    }

    await page.screenshot({ path: process.env.SHOT ?? 'test-results/chat-theme.png' });
    await page.reload();
    await expect(side).toHaveCSS('background-color', 'rgb(63, 14, 64)');

    await page.getByRole('button', { name: 'Chat appearance' }).click();
    await page.getByRole('dialog').getByLabel('Sidebar', { exact: true }).fill('#0b3c5d');
    await expect(side).toHaveCSS('background-color', 'rgb(11, 60, 93)');
    await page.getByRole('dialog').getByRole('button', { name: 'Reset to default' }).click();
    await expect(side).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });
});
