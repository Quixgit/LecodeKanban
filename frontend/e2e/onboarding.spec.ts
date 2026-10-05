import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:48100';
const stamp = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const PASSWORD = 'Kanban-Board-2026';
/** An 8×8 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPw2boOK2IYWhIAAb5rwYi2NGsAAAAASUVORK5CYII=',
  'base64',
);

test.describe('Welcome wizard', () => {
  test('a new account with no workspace creates one and introduces themselves', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('lk-lang', 'en'));
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Onboard Tester');
    await page.getByLabel('Email').fill(`ob-${stamp()}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    const wizard = page.getByRole('dialog');
    await expect(wizard.getByRole('heading', { name: 'Welcome, Onboard!' })).toBeVisible();
    await page.waitForTimeout(900);
    const axe = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
    await wizard.getByRole('button', { name: "Let's go" }).click();

    await expect(wizard.getByRole('heading', { name: 'Name your workspace' })).toBeVisible();
    // The workspace made at registration is named for them; they rename it.
    await expect(wizard.getByLabel('Workspace name')).toHaveValue("Onboard's workspace");
    await wizard.getByLabel('Workspace name').fill('');
    await wizard.getByRole('button', { name: 'Continue' }).click();
    await expect(wizard.getByText('Give your workspace a name.')).toBeVisible();
    await wizard.getByLabel('Workspace name').fill('Acme Test Studio');
    await wizard.getByRole('button', { name: 'Continue' }).click();

    // About: the name is there, a role chip fills the title.
    await expect(wizard.getByRole('heading', { name: 'Tell us about you' })).toBeVisible();
    await expect(wizard.getByLabel('Full name')).toHaveValue('Onboard Tester');
    await wizard.getByRole('button', { name: 'Developer' }).click();
    await expect(wizard.getByLabel('Job title')).toHaveValue('Developer');
    await wizard.getByRole('button', { name: 'Continue' }).click();

    // Photo.
    await expect(wizard.getByRole('heading', { name: 'Add a photo' })).toBeVisible();
    await wizard
      .locator('input[type=file]')
      .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await expect(wizard.getByText('Looks great!')).toBeVisible();
    await wizard.getByRole('button', { name: 'Continue' }).click();

    // Contacts: a bad Telegram name is refused, then fixed.
    await expect(wizard.getByRole('heading', { name: 'How can people reach you?' })).toBeVisible();
    await wizard.getByLabel('Telegram').fill('ab');
    await wizard.getByRole('button', { name: 'Continue' }).click();
    await expect(wizard.getByText(/5–32 letters/)).toBeVisible();
    await wizard.getByLabel('Telegram').fill('@onboard_tester');
    await wizard.getByLabel('Phone').fill('+380 67 123 45 67');
    await wizard.getByRole('button', { name: 'Use my phone number' }).click();
    await wizard.getByRole('button', { name: 'Continue' }).click();

    // Team: one invitation.
    await expect(wizard.getByRole('heading', { name: 'Invite your team' })).toBeVisible();
    await wizard.getByLabel('E-mail addresses').fill(`mate-${stamp()}@example.com`);
    await wizard.getByLabel('E-mail addresses').press('Enter');
    await wizard.getByRole('button', { name: 'Continue' }).click();

    // Done.
    await expect(wizard.getByRole('heading', { name: "You're all set!" })).toBeVisible();
    await expect(wizard.getByText('Acme Test Studio').first()).toBeVisible();
    await wizard.getByRole('button', { name: 'Open my workspace' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // It does not come back, and what was entered is on the profile.
    await page.reload();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/profile');
    await expect(page.getByLabel('Job title')).toHaveValue('Developer');
    await expect(page.getByLabel('WhatsApp')).toHaveValue('+380671234567');
    await ctx.close();
  });

  test('skipping closes the wizard; Help can bring it back', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('lk-lang', 'en'));
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Skipper');
    await page.getByLabel('Email').fill(`skip-${stamp()}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Skip setup' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/help');
    await page.getByRole('button', { name: 'Run the welcome guide again' }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Welcome, Skipper!' }),
    ).toBeVisible();
    await ctx.close();
  });

  test('an invited person only introduces themselves', async ({ page, browser }) => {
    // The owner invites someone and copies the link.
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/team');
    await page
      .getByRole('button', { name: /Invite/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    const email = `join-${stamp()}@example.com`;
    await dialog.getByLabel('Email address').fill(email);
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    const link = await dialog.getByLabel('Invitation link').inputValue();
    await dialog.getByRole('button', { name: 'Done' }).click();

    // The guest registers through the link, accepts it, and meets the short wizard.
    const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 900 } });
    const guest = await ctx.newPage();
    await guest.addInitScript(() => localStorage.setItem('lk-lang', 'en'));
    const path = new URL(link).pathname;
    await guest.goto(`/register?next=${encodeURIComponent(path)}`);
    await guest.getByLabel('Full name').fill('Guest Person');
    await guest.getByLabel('Email').fill(email);
    await guest.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await guest.getByLabel('Confirm password').fill(PASSWORD);
    await guest.getByRole('button', { name: 'Create account' }).click();
    await guest.getByRole('button', { name: 'Join workspace' }).click();

    const wizard = guest.getByRole('dialog');
    await expect(wizard.getByRole('heading', { name: /Welcome to .+, Guest!/ })).toBeVisible();
    await wizard.getByRole('button', { name: "Let's go" }).click();
    await expect(wizard.getByRole('heading', { name: 'Tell us about you' })).toBeVisible();
    await expect(wizard.getByRole('heading', { name: 'Name your workspace' })).toHaveCount(0);
    await wizard.getByLabel('Job title').fill('Designer');
    await wizard.getByRole('button', { name: 'Continue' }).click();
    await wizard.getByRole('button', { name: 'Skip this step' }).click(); // photo
    await wizard.getByLabel('WhatsApp').fill('+380 50 111 22 33');
    await wizard.getByRole('button', { name: 'Continue' }).click();
    await expect(wizard.getByRole('heading', { name: "You're all set!" })).toBeVisible();
    await wizard.getByRole('button', { name: 'Open my workspace' }).click();
    await expect(guest.getByRole('dialog')).toHaveCount(0);
    await ctx.close();

    // Clean up the owner's list.
    await page.reload();
    await page
      .getByRole('button', { name: 'Revoke' })
      .first()
      .click()
      .catch(() => undefined);
  });
});
