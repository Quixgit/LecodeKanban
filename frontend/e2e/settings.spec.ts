import AxeBuilder from '@axe-core/playwright';
import { expect, openKanban, signIn, test } from './fixtures';

const stamp = () => Date.now().toString(36);

async function axeClean(page: import('@playwright/test').Page) {
  // Cards fade in one after another; contrast is measured on the settled page.
  await page.waitForTimeout(700);
  const axe = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
}

test.describe('Settings admin centre', () => {
  test('overview, navigation and general settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click();
    await expect(page).toHaveURL(/\/settings$/);
    const main = page.getByRole('main');
    await expect(main.getByText('Admin centre')).toBeVisible();
    for (const name of ['General', 'Custom fields', 'Labels', 'Members & roles', 'Integrations'])
      await expect(main.locator('ul').getByRole('link', { name: new RegExp(name) })).toBeVisible();
    await axeClean(page);

    // The section list moves the highlight; no language/theme/profile controls here.
    await page
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('link', { name: 'General' })
      .click();
    await expect(page).toHaveURL(/\/settings\/general$/);
    await expect(main.getByRole('heading', { name: 'Danger zone' })).toBeVisible();

    // Rename the workspace and put the name back.
    const name = main.getByLabel('Workspace name');
    const original = await name.inputValue();
    await name.fill(`${original} ${stamp()}`);
    await main.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Workspace updated')).toBeVisible();
    await name.fill(original);
    await main.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Workspace updated').first()).toBeVisible();

    // Deleting needs the name typed in; cancel leaves everything alone.
    await main.getByRole('button', { name: 'Delete workspace' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Delete forever' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await axeClean(page);

    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/profile$/);
  });

  test('labels: create, recolour, delete', async ({ page }) => {
    await signIn(page);
    await page.goto('/settings/labels');
    const main = page.getByRole('main');
    const label = `e2e-${stamp()}`;
    await main.getByRole('button', { name: 'New label' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(label);
    await dialog.getByRole('radio', { name: 'Purple' }).click();
    await dialog.getByRole('button', { name: 'Create label' }).click();
    await expect(main.getByText(label, { exact: true })).toBeVisible();
    await axeClean(page);

    await main.getByRole('button', { name: `Edit ${label}` }).click();
    await page.getByRole('dialog').getByLabel('Name').fill(`${label}-b`);
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(main.getByText(`${label}-b`, { exact: true })).toBeVisible();

    await main.getByRole('button', { name: `Delete ${label}-b` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete label' }).click();
    await expect(main.getByText(`${label}-b`, { exact: true })).toHaveCount(0);
  });

  test('custom fields: define, fill on a task, show on the board, reorder, delete', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/settings/fields');
    const main = page.getByRole('main');
    const tag = stamp();
    const budget = `Budget ${tag}`;
    const risk = `Risk ${tag}`;

    // A number and a choice, both shown on the board.
    await main.getByRole('button', { name: 'New field' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(budget);
    await dialog.getByRole('combobox', { name: 'Type' }).click();
    await page.getByRole('option', { name: 'Number' }).click();
    await dialog.getByRole('switch', { name: 'Show on the board' }).click();
    await dialog.getByRole('button', { name: 'Create field' }).click();
    await expect(main.getByText(budget, { exact: true })).toBeVisible();

    await main.getByRole('button', { name: 'New field' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(risk);
    await dialog.getByRole('combobox', { name: 'Type' }).click();
    await page.getByRole('option', { name: 'Choice' }).click();
    await dialog.getByRole('button', { name: 'Add a choice' }).click();
    await dialog.getByRole('textbox', { name: 'Choice 1' }).fill('Low');
    await dialog.getByRole('button', { name: 'Add a choice' }).click();
    await dialog.getByRole('textbox', { name: 'Choice 2' }).fill('High');
    await dialog.getByRole('switch', { name: 'Show on the board' }).click();
    await dialog.getByRole('button', { name: 'Create field' }).click();
    await expect(main.getByText(risk, { exact: true })).toBeVisible();

    // A duplicate name is refused by the server.
    await main.getByRole('button', { name: 'New field' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill(budget.toLowerCase());
    await page.getByRole('dialog').getByRole('button', { name: 'Create field' }).click();
    await expect(page.getByRole('dialog').getByText(/already exists/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await axeClean(page);

    // Reorder: the choice field goes above the budget.
    await main.getByRole('button', { name: `Move ${risk} up` }).click();
    await expect(main.getByRole('listitem').filter({ hasText: risk }).first()).toBeVisible();

    // Fill them on a task; the chips show on the board card.
    await openKanban(page);
    await page.locator('article').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Custom fields')).toBeVisible();
    const num = drawer.getByRole('spinbutton', { name: budget });
    await num.fill('1200');
    await num.blur();
    await drawer.getByRole('combobox', { name: risk }).click();
    await page.getByRole('option', { name: 'High' }).click();
    await page.reload();
    const again = page.getByRole('dialog');
    await expect(again.getByRole('spinbutton', { name: budget })).toHaveValue('1200');
    await expect(again.getByRole('combobox', { name: risk })).toContainText('High');
    await again.getByRole('button', { name: 'Close' }).first().click();
    await expect(page.locator('article').getByText('High').first()).toBeVisible();
    await expect(page.locator('article').getByText('1,200').first()).toBeVisible();

    // Delete both fields: the values and the chips are gone.
    await page.goto('/settings/fields');
    for (const f of [budget, risk]) {
      await main.getByRole('button', { name: `Delete ${f}` }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete field' }).click();
      await expect(main.getByText(f, { exact: true })).toHaveCount(0);
    }
  });
});
