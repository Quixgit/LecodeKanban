import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

async function axeClean(page: Page) {
  await page.waitForTimeout(900); // cards rise in one after another
  const axe = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
}

test.describe('Help & Center', () => {
  test('search, quick start, guides, shortcuts, news and status', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await page.getByRole('link', { name: 'Help & Center', exact: true }).first().click();
    await expect(page).toHaveURL(/\/help$/);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'How can we help?' })).toBeVisible();

    // Quick start: the demo workspace already has projects and tasks, so those steps are done by themselves.
    await expect(main.getByRole('heading', { name: 'Quick start' })).toBeVisible();
    await expect(main.getByText(/\d of 5 done/)).toBeVisible();
    const mark = main.getByRole('checkbox', { name: 'Mark as done' });
    await mark.click();
    await expect(main.getByRole('checkbox', { name: 'Mark as not done' })).toBeVisible();
    await main.getByRole('checkbox', { name: 'Mark as not done' }).click();

    // Search finds a guide article and opens it.
    await main.getByRole('searchbox', { name: /Search help/ }).fill('restoring');
    await main.getByRole('button', { name: /Deleted tasks and restoring/ }).click();
    await expect(page).toHaveURL(/guide=tasks&article=trash/);
    await expect(
      main.getByRole('heading', { name: 'Deleted tasks and restoring', level: 3 }),
    ).toBeVisible();
    await expect(main.getByText('Open Tasks → Trash', { exact: false })).toBeVisible();
    await main.getByRole('button', { name: 'Find tasks fast' }).click();
    await expect(page).toHaveURL(/article=find/);
    await main.getByRole('button', { name: 'All guides' }).click();
    await expect(main.getByRole('button', { name: /Chat/ }).first()).toBeVisible();

    // Shortcuts have a filter.
    await main.getByRole('searchbox', { name: 'Filter shortcuts' }).fill('palette');
    await expect(main.getByText('Open the command palette')).toBeVisible();
    await expect(main.getByText('Go to Dashboard')).toHaveCount(0);

    await expect(main.getByRole('heading', { name: "What's new" })).toBeVisible();
    await expect(main.getByText(/Version \d/)).toBeVisible();
    await axeClean(page);
  });

  test('"Learn more" on Roles opens its guide', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await page.goto('/settings/roles');
    await page.getByRole('main').getByRole('link', { name: 'Learn more in Help' }).click();
    await expect(page).toHaveURL(/guide=roles&article=permissions/);
    await expect(
      page.getByRole('heading', { name: 'Roles and permissions', level: 3 }),
    ).toBeVisible();
  });

  test('Ukrainian and phone width', async ({ page }) => {
    // The profile language wins once signed in, so switch it the way a person does, and put it back at the end.
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.getByRole('radio', { name: 'Українська' }).click();
    await page.goto('/help');
    await page.setViewportSize({ width: 390, height: 844 });
    const main = page.getByRole('main');
    try {
      await expect(main.getByRole('heading', { name: 'Чим вам допомогти?' })).toBeVisible();
      await main.getByRole('searchbox', { name: /Шукайте/ }).fill('кошик');
      await expect(
        main.getByRole('button', { name: /Видалені завдання та відновлення/ }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('radio', { name: 'English' }).click();
      await expect(page.getByRole('heading', { name: 'Help & Center', level: 1 })).toBeVisible();
    }
  });
});
