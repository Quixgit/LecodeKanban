import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Sign-in and registration pages', () => {
  test('login: the showcase is there, the form passes axe, light and dark', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((t) => {
        localStorage.setItem('lk-lang', 'en');
        localStorage.setItem('lk-theme', JSON.stringify({ state: { preference: t }, version: 0 }));
      }, theme);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: /One workspace for how your team ships/ }),
      ).toBeVisible();
      await page.waitForTimeout(1200);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(axe.violations.map((v) => `${theme} ${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    }
  });

  test('registration asks for the password twice and says when they differ', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Test Person');
    await page.getByLabel('Email').fill('test.person@example.com');
    await page.getByLabel('Password', { exact: true }).fill('Kanban-Board-2026');
    await page.getByLabel('Confirm password').fill('Kanban-Board-2027');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText("Passwords don't match.")).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
    await page.getByLabel('Confirm password').fill('Kanban-Board-2026');
    await expect(page.getByText("Passwords don't match.")).toHaveCount(0);
  });

  test('phone width: no horizontal scroll, the form comes first', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });
});
