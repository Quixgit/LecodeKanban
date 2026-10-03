import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openKanban, signIn, test } from './fixtures';

async function openFirstCard(page: Page) {
  await openKanban(page);
  await page.goto('/tasks');
  await page.locator('article').first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('radio', { name: 'Comments' })).toBeChecked();
  return drawer;
}

test.describe('Task window', () => {
  test('has one Comments conversation, an expandable window and a compact timer', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    const drawer = await openFirstCard(page);

    // Comments is the chat; the old separate Chat and comment-list tabs are gone.
    await expect(drawer.getByRole('radio', { name: 'Chat' })).toHaveCount(0);
    await expect(drawer.getByRole('radio', { name: 'Activity' })).toBeVisible();

    // The timer sits in the side panel and runs.
    const start = drawer.getByRole('button', { name: /Start timer|Start here/ });
    await start.click();
    await expect(drawer.getByRole('timer')).toBeVisible();
    await drawer.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(drawer.getByRole('timer')).toHaveCount(0);

    // Manual time lives behind "Log time".
    await drawer.getByRole('button', { name: 'Log time' }).first().click();
    await expect(drawer.getByRole('textbox', { name: 'Time spent' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Log time' }).first().click();

    // Full screen: the panel grows to the viewport width and remembers the choice.
    const width = async () => (await drawer.boundingBox())!.width;
    expect(await width()).toBeLessThan(900);
    await drawer.getByRole('button', { name: 'Expand to full screen' }).click();
    await expect.poll(width).toBeGreaterThan(1400);
    await page.screenshot({ path: 'test-results/card-drawer-expanded.png' });
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect
      .poll(async () => (await page.getByRole('dialog').boundingBox())!.width)
      .toBeGreaterThan(1400);
    await page.getByRole('dialog').getByRole('button', { name: 'Back to side panel' }).click();
    await expect.poll(width).toBeLessThan(900);
    await page.screenshot({ path: 'test-results/card-drawer-panel.png' });

    const results = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
