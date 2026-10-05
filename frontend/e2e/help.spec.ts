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
    // The technical side: changes carry API notes, plans are listed, versions say what runs.
    await expect(main.getByText(/GET \/workspaces\/\{id\}\/time/)).toBeVisible();
    await main.getByRole('radio', { name: 'Planned' }).click();
    await expect(main.getByText('Task templates and recurring tasks')).toBeVisible();
    await main.getByRole('radio', { name: 'Versions' }).click();
    await expect(main.getByText('PostgreSQL', { exact: false }).first()).toBeVisible();
    await expect(main.getByText('react', { exact: true })).toBeVisible();
    await axeClean(page);
  });

  test('contact the team: send a request with a screenshot, then handle it in the inbox', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await signIn(page);
    await page.goto('/help#support');
    const main = page.getByRole('main');
    const subject = `E2E request ${Date.now().toString(36)}`;
    const support = main.locator('#support');
    await expect(support.getByRole('heading', { name: 'Contact the team' })).toBeVisible();

    // Required fields are checked before anything is sent.
    await support.getByRole('button', { name: 'Send' }).click();
    await expect(support.getByText('This field is required.').first()).toBeVisible();

    await support.getByRole('radio', { name: 'Idea' }).click();
    await support.getByLabel('Subject').fill(subject);
    await support.getByLabel('Details').fill('A longer description of the idea.');
    // A 1×1 PNG.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    await support
      .getByLabel('Attach a screenshot')
      .setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: png });
    await expect(support.getByText('shot.png')).toBeVisible();
    await support.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText('Sent. The team has been told.')).toBeVisible();
    await expect(support.getByText(subject)).toBeVisible();

    // The owner handles support: open the request in the inbox and resolve it.
    const inbox = main.locator('#support-inbox');
    await expect(inbox.getByRole('heading', { name: 'Support inbox' })).toBeVisible();
    await inbox.getByRole('button', { name: new RegExp(subject) }).click();
    await expect(inbox.getByText('A longer description of the idea.')).toBeVisible();
    await expect(inbox.getByRole('img', { name: new RegExp(subject) })).toBeVisible();
    await inbox.getByRole('button', { name: 'Mark as resolved' }).click();
    await expect(
      inbox.getByRole('button', { name: new RegExp(subject) }).getByText('Resolved'),
    ).toBeVisible();

    await page.waitForTimeout(900);
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
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
