import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

test.describe('Notification preferences', () => {
  test('switch a kind off, it stays off after a reload, switch it back on', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page);
    await page.goto('/profile/notifications');
    const main = page.getByRole('main');
    const sw = main.getByRole('switch', { name: 'Meeting reminders' });
    await expect(sw).toBeChecked();
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    await sw.click();
    await expect(sw).not.toBeChecked();
    await page.reload();
    await expect(main.getByRole('switch', { name: 'Meeting reminders' })).not.toBeChecked();
    // Everything else stayed on.
    await expect(main.getByRole('switch', { name: 'Mentions' })).toBeChecked();

    await main.getByRole('switch', { name: 'Meeting reminders' }).click();
    await page.reload();
    await expect(main.getByRole('switch', { name: 'Meeting reminders' })).toBeChecked();
  });
});
