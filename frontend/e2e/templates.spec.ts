import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

const stamp = () => Math.random().toString(36).slice(2, 8);

test.describe('Templates and recurring tasks', () => {
  test('make a template, create a task from it, schedule it, pause and delete', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await page.goto('/templates');
    const main = page.getByRole('main');
    await expect(main.getByRole('radio', { name: 'Templates' })).toBeVisible();

    // A template with a checklist, a subtask and a due offset.
    const id = stamp();
    const name = `Weekly report ${id}`;
    const title = `Report ${id}`;
    await main.getByRole('button', { name: 'New template' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Template name').fill(name);
    await dialog.getByLabel('Task title').fill(title);
    await dialog.getByLabel('Checklist').fill('Collect the numbers\nWrite the summary');
    await dialog.getByLabel('Subtasks').fill('Draft');
    await dialog.getByLabel('Due after (days)').fill('3');
    await dialog.getByRole('button', { name: 'Save' }).click();
    const card = main.getByRole('listitem').filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card.getByText('2 checklist items')).toBeVisible();
    await expect(card.getByText('1 subtask')).toBeVisible();
    await expect(card.getByText('Due in 3 days')).toBeVisible();

    // Axe runs once the confirmation toast has gone and the page has settled.
    await expect(page.getByText('Template saved')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(900);
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(
      axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`),
    ).toEqual([]);

    // Create a task from it: a project is required.
    await card.getByRole('button', { name: 'Create task' }).click();
    const use = page.getByRole('dialog');
    await use.getByRole('button', { name: 'Create task' }).click();
    await expect(use.getByText('Choose a project.')).toBeVisible();
    await use.getByRole('combobox', { name: 'Project' }).click();
    await page.getByRole('option').first().click();
    const made = page.waitForResponse((r) => /\/templates\/.+\/use$/.test(r.url()));
    await use.getByRole('button', { name: 'Create task' }).click();
    const card_ = (await (await made).json()) as { id: string };
    await expect(page.getByText('Task created').first()).toBeVisible();

    // The task exists, with its checklist and subtask.
    await page.goto(`/tasks?card=${card_.id}`);
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText(title).first()).toBeVisible();
    await expect(drawer.getByText('Collect the numbers')).toBeVisible();
    await expect(drawer.getByText('Draft')).toBeVisible();
    await page.keyboard.press('Escape');

    // A weekly schedule on Monday and Wednesday.
    await page.goto('/templates');
    await main.getByRole('radio', { name: 'Recurring' }).click();
    await main.getByRole('button', { name: 'New schedule' }).first().click();
    const sched = page.getByRole('dialog');
    await sched.getByRole('button', { name: 'Save' }).click();
    await expect(sched.getByText('Choose a template.')).toBeVisible();
    await sched.getByRole('combobox', { name: 'Template' }).click();
    await page.getByRole('option', { name }).click();
    await sched.getByRole('combobox', { name: 'Project' }).click();
    await page.getByRole('option').first().click();
    await sched.getByRole('button', { name: /^Wed/ }).click();
    await sched.getByRole('button', { name: 'Save' }).click();
    const row = main.getByRole('listitem').filter({ hasText: name });
    await expect(row.getByText(/Every Mon, Wed at 09:00/)).toBeVisible();
    await expect(row.getByText(/Next:/)).toBeVisible();

    // Pause it, then remove it and the template.
    await row.getByRole('switch').click();
    await expect(row.getByText('Paused')).toBeVisible();
    await row.getByRole('button', { name: 'Delete schedule' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(main.getByText('No schedules yet')).toBeVisible();

    await main.getByRole('radio', { name: 'Templates' }).click();
    await main.getByRole('button', { name: `Delete ${name}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(main.getByRole('listitem').filter({ hasText: name })).toHaveCount(0);
  });

  test('Ukrainian and phone width', async ({ page }) => {
    // The profile language wins once signed in, so switch it the way a person does, and put it back at the end.
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.getByRole('radio', { name: 'Українська' }).click();
    await page.goto('/templates');
    await page.setViewportSize({ width: 390, height: 844 });
    try {
      await expect(page.getByRole('main').getByRole('radio', { name: 'Шаблони' })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('radio', { name: 'English' }).click();
    }
  });
});
