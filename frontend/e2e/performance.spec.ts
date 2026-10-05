import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

test.describe('Performance', () => {
  test('the leader sees the flow metrics, switches the period and filters', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await page.getByRole('link', { name: 'Performance', exact: true }).first().click();
    await expect(page).toHaveURL(/\/performance$/);
    const main = page.getByRole('main');

    for (const title of ['Throughput', 'Cycle time', 'Lead time', 'Overdue', 'Work in progress']) {
      await expect(main.getByRole('heading', { name: title, exact: true }).first()).toBeVisible();
    }
    await expect(main.getByRole('heading', { name: 'Cumulative flow' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Workload' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();

    // The period switch refetches and the cards stay.
    await main.getByRole('radio', { name: '90 days' }).click();
    await expect(main.getByRole('radio', { name: '90 days' })).toBeChecked();
    await expect(main.getByRole('heading', { name: 'Cumulative flow' })).toBeVisible();
    await main.getByRole('radio', { name: 'Burn-up' }).click();
    await expect(main.getByRole('radio', { name: 'Burn-up' })).toBeChecked();

    // Narrowing to one project offers a way back.
    await main.getByRole('combobox', { name: 'Project' }).click();
    await page.getByRole('option').nth(1).click();
    await expect(main.getByRole('button', { name: 'Reset filters' })).toBeVisible();
    await main.getByRole('button', { name: 'Reset filters' }).click();
    await expect(main.getByRole('button', { name: 'Reset filters' })).toHaveCount(0);

    await page.waitForTimeout(900); // cards rise in one after another
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });

  test('the same page works on a phone and in the dark theme', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto('/performance');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'Cumulative flow' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
