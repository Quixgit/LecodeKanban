import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

test.describe('Icon-rail menu', () => {
  test('icons, a menu for the chosen section, content to the right; switch back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Icon menu' }).click();

    const aside = page.getByRole('complementary');
    // The section's own menu sits next to the icons; the page no longer repeats it.
    const menu = aside.getByRole('navigation', { name: 'Settings' });
    await expect(menu.getByRole('link', { name: 'Roles & permissions' })).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('navigation', { name: 'Settings sections' }),
    ).toBeHidden();
    await menu.getByRole('link', { name: 'Roles & permissions' }).click();
    await expect(page).toHaveURL(/\/settings\/roles$/);

    // Tasks: statuses with counts.
    await aside.getByRole('link', { name: 'Tasks' }).click();
    const tasks = aside.getByRole('navigation', { name: 'Tasks' });
    await expect(tasks.getByRole('link', { name: /In Review/ })).toBeVisible();
    await tasks.getByRole('link', { name: /In Review/ }).click();
    await expect(page).toHaveURL(/\/tasks\/in-review$/);

    // A section without a menu (Calendar) closes the second column.
    await aside.getByRole('link', { name: 'Calendar' }).click();
    await expect(aside.getByRole('navigation', { name: 'Tasks' })).toBeHidden();

    // Chat and Docs keep their own lists in the rail's column; the page itself is only the conversation / the page.
    await aside.getByRole('link', { name: 'Chat' }).click();
    await expect(page).toHaveURL(/\/chat/);
    const railChat = page.locator('aside[aria-label="Main navigation"] aside[aria-label="Chat"]');
    await expect(railChat).toBeVisible();
    await expect(page.getByRole('main').locator('aside[aria-label="Chat"]')).toHaveCount(0);
    await aside.getByRole('link', { name: 'Docs' }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(
      page.locator('aside[aria-label="Main navigation"]').getByRole('tree').first(),
    ).toBeVisible();

    await page.waitForTimeout(500);
    const axe = await new AxeBuilder({ page })
      .include('aside')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    // The choice is remembered, and the classic menu is one click away.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Classic menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Classic menu' }).click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();
  });
});
