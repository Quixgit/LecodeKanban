import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

test.describe('Interface', () => {
  test('? lists the shortcuts of the page and g then a letter jumps', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/tasks');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Shift+?');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'Everywhere' })).toBeVisible();
    await expect(dialog.getByText('Go to Chat')).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(page).toHaveURL(/\/projects$/);
    await page.keyboard.press('g');
    await page.keyboard.press('s');
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('compact density tightens the header and sticks after a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/profile');
    const header = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim(),
      );
    expect(await header()).toBe('64px');
    await page.getByRole('radio', { name: 'Compact' }).click();
    await expect.poll(header).toBe('56px');
    await page.reload();
    expect(await header()).toBe('56px');
    await page.getByRole('radio', { name: 'Comfortable' }).click();
    await expect.poll(header).toBe('64px');
  });

  test('the icon menu works on a phone: tap an icon, pick from its menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.addInitScript(() =>
      localStorage.setItem(
        'lk-shell-layout',
        JSON.stringify({ state: { layout: 'rail' }, version: 0 }),
      ),
    );
    await signIn(page);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('complementary', { name: 'Main navigation' });
    await drawer.getByRole('button', { name: 'Settings' }).click();
    await expect(drawer.getByRole('link', { name: 'Roles & permissions' })).toBeVisible();
    await page.waitForTimeout(400);
    const axe = await new AxeBuilder({ page })
      .include('aside')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    await drawer.getByRole('link', { name: 'Roles & permissions' }).click();
    await expect(page).toHaveURL(/\/settings\/roles$/);
    // The drawer closed behind the navigation.
    await expect(page.getByRole('complementary', { name: 'Main navigation' })).toHaveCount(0);
  });
});
