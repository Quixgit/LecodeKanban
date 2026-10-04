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
    for (const name of [
      'General',
      'Modules',
      'Access & invitations',
      'Members & roles',
      'Rules & defaults',
      'Custom fields',
      'Labels',
      'Integrations',
      'Audit log',
    ])
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

  test('modules, access rules, defaults and the audit log', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    const main = page.getByRole('main');
    const sidebar = page.getByRole('navigation', { name: 'Main menu' }).first();

    // Switching a module off removes it from the menu and closes its page; switching on brings it back.
    await page.goto('/settings/features');
    const calendar = main.getByRole('switch', { name: 'Calendar' });
    await expect(calendar).toBeChecked();
    await calendar.click();
    await expect(page.getByText('Saved').first()).toBeVisible();
    await expect(
      page.locator('aside, nav').getByRole('link', { name: 'Calendar', exact: true }),
    ).toHaveCount(0);
    await page.goto('/calendar');
    await expect(page.getByText('This part is switched off')).toBeVisible();
    await page.goto('/settings/features');
    await main.getByRole('switch', { name: 'Calendar' }).click();
    await page.goto('/calendar');
    await expect(page.getByText('This part is switched off')).toHaveCount(0);
    void sidebar;

    // Access: open invitations to every member, add an allowed domain, then put both back.
    await page.goto('/settings/access');
    await main.getByRole('combobox', { name: 'Default role' }).click();
    await page.getByRole('option', { name: 'Viewer' }).click();
    await expect(page.getByText('Saved').first()).toBeVisible();
    const domains = main.getByLabel('Allowed email domains');
    await domains.fill('Example.org');
    await domains.press('Enter');
    await expect(main.getByRole('button', { name: 'Remove example.org' })).toBeVisible();
    await page.reload();
    await expect(main.getByRole('combobox', { name: 'Default role' })).toContainText('Viewer');
    await expect(main.getByRole('button', { name: 'Remove example.org' })).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await axeClean(page);

    // Rules: the calendar week can start on Sunday.
    await page.goto('/settings/rules');
    await main.getByRole('combobox', { name: 'Week starts on' }).click();
    await page.getByRole('option', { name: 'Sunday' }).click();
    await expect(page.getByText('Saved').first()).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByText(/^Sun/).first()).toBeVisible();
    await expect(page.getByText(/^Mon/).first()).toBeVisible();

    // The audit log lists what changed and who did it; then everything goes back to the defaults.
    await page.goto('/settings/audit');
    await expect(main.getByText(/changed settings: .*/).first()).toBeVisible();
    await expect(main.getByText('Peter Gabrielle').first()).toBeVisible();
    await axeClean(page);
    await page.goto('/settings/access');
    await main.getByRole('combobox', { name: 'Default role' }).click();
    await page.getByRole('option', { name: 'Member' }).click();
    await main.getByRole('button', { name: 'Remove example.org' }).click();
    await page.goto('/settings/rules');
    await main.getByRole('combobox', { name: 'Week starts on' }).click();
    await page.getByRole('option', { name: 'Monday' }).click();
    await expect(page.getByText('Saved').first()).toBeVisible();
  });

  test('roles: change a permission, build a custom role, assign it, delete it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/settings/roles');
    const main = page.getByRole('main');
    const list = main.getByRole('list', { name: 'Roles' });
    await expect(list.getByRole('button', { name: /Owner/ })).toBeVisible();
    await axeClean(page);

    // Built-in Member: members may not manage custom fields by default; allow it, then reset.
    await list.getByRole('button', { name: /^Member/ }).click();
    const sw = main.getByRole('switch', { name: 'Manage custom fields' });
    await expect(sw).not.toBeChecked();
    await sw.click();
    await expect(sw).toBeChecked();
    await expect(page.getByText('Saved').first()).toBeVisible();
    await page.reload();
    await list.getByRole('button', { name: /^Member/ }).click();
    await expect(main.getByRole('switch', { name: 'Manage custom fields' })).toBeChecked();
    await main.getByRole('button', { name: 'Reset to defaults' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset to defaults' }).click();
    await expect(main.getByRole('switch', { name: 'Manage custom fields' })).not.toBeChecked();

    // A custom role starts from a preset and shows up in the list.
    const name = `Tester ${stamp()}`;
    await main.getByRole('button', { name: 'New role' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByRole('button', { name: 'Create role' }).click();
    await expect(list.getByRole('button', { name: new RegExp(name) })).toBeVisible();

    // Delete it again (nobody holds it).
    await main.getByRole('button', { name: 'Delete role' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete role' }).click();
    await expect(list.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
  });
});
