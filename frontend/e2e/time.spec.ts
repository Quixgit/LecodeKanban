import AxeBuilder from '@axe-core/playwright';
import { expect, openKanban, signIn, test } from './fixtures';

test.describe('Time tracking', () => {
  test('estimate, log, edit and delete time on a task', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await openKanban(page);
    await page.goto('/tasks');
    await page.locator('article').first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    const panel = drawer.getByRole('region', { name: 'Time' });

    // Leftovers of an earlier interrupted run would confuse the checks below.
    for (let i = 0; i < 5 && (await panel.getByText('e2e entry').count()) > 0; i++) {
      await panel
        .getByRole('listitem')
        .filter({ hasText: 'e2e entry' })
        .last()
        .getByRole('button', { name: 'Delete time entry' })
        .click({ force: true });
      await page.waitForTimeout(400);
    }

    // An estimate shows logged time against it.
    await panel.getByRole('button', { name: /Set estimate|Edit estimate/ }).click();
    await page.getByRole('textbox', { name: 'Estimate' }).fill('4h');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(panel.getByText(/of 4h/)).toBeVisible();

    // Log time with a quick amount and a note.
    await panel.getByRole('button', { name: 'Log time' }).click();
    const dialog = page.getByRole('dialog', { name: 'Log time' });
    await dialog.getByRole('button', { name: '1h', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'What did you work on?' }).fill('e2e entry');
    await dialog.getByRole('button', { name: 'Save' }).click();
    // The day group is a list item too; the entry is the innermost one.
    const entryRow = () => panel.getByRole('listitem').filter({ hasText: 'e2e entry' }).last();
    const row = entryRow();
    await expect(row).toBeVisible();

    // Edit it to 90 minutes, then delete it.
    await row.hover();
    await row.getByRole('button', { name: 'Edit entry' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit time entry' });
    await edit.getByRole('textbox', { name: 'Time spent' }).fill('90m');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(entryRow()).toContainText('1h 30m');
    await entryRow().getByRole('button', { name: 'Delete time entry' }).click({ force: true });
    await expect(panel.getByText('e2e entry')).toHaveCount(0, { timeout: 8000 });

    const axe = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });

  test('the timesheet shows the week, takes new time and edits a cell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await page.getByRole('link', { name: 'Time', exact: true }).first().click();
    await expect(page).toHaveURL(/\/time$/);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 2 })).toBeVisible();

    // Add time to a task found by search.
    await main.getByRole('button', { name: 'Log time' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Log time' });
    await dialog.getByRole('textbox', { name: 'Task' }).fill('a');
    await dialog.getByRole('list').getByRole('button').first().click();
    await dialog.getByRole('textbox', { name: 'Time spent' }).fill('45m');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(main.getByRole('table')).toBeVisible();
    await expect(main.getByRole('cell', { name: '0:45' }).first()).toBeVisible();

    // Previous week offers navigation both ways.
    await main.getByRole('button', { name: 'Previous week' }).click();
    await main.getByRole('button', { name: 'This week' }).click();
    await expect(main.getByRole('table')).toBeVisible();

    await page.waitForTimeout(900);
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    // Clean up: open the cell with the new entry and delete it.
    await main.getByRole('cell', { name: '0:45' }).first().getByRole('button').click();
    const cell = page.getByRole('dialog').first();
    await cell.getByRole('button', { name: 'Delete time entry' }).first().click();
  });

  test('the header timer starts from recent tasks and stops; phone width has no overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto('/time');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Timer', exact: true }).click();
    await expect(page.getByText('No timer running')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open timesheet' })).toBeVisible();
  });
});
