import AxeBuilder from '@axe-core/playwright';
import { expect, signIn, test } from './fixtures';

const PASSWORD = process.env.E2E_PASSWORD ?? '';
const TEMP = 'Temp-Passw0rd-2026!';
// A real 1×1 PNG: the page decodes and crops it before uploading.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Profile settings', () => {
  test('profile: name, photo, accessibility', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { name: 'Personal information' })).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    // The name: save is off until something changes; the new name shows in the header at once.
    const name = page.getByLabel('Full name');
    const save = page.getByRole('button', { name: 'Save changes' });
    await expect(save).toBeDisabled();
    const original = await name.inputValue();
    const renamed = original.endsWith(' Jr') ? original.slice(0, -3) : `${original} Jr`;
    await name.fill(renamed);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Account menu' }).getByText(renamed, { exact: true }),
    ).toBeVisible();
    await name.fill('');
    await name.blur();
    await expect(page.getByText(/required/i).first()).toBeVisible();
    await name.fill(original);
    await save.click();
    await expect(
      page.getByRole('button', { name: 'Account menu' }).getByText(original, { exact: true }),
    ).toBeVisible();

    // The photo: upload, see it in the header, then remove it.
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Photo updated')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: 'Account menu' }).locator('img[src*="/avatar?v="]'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByText('Choose a PNG, JPEG, WebP or GIF picture.')).toBeVisible();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('Photo removed')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Account menu' }).locator('img[src*="/avatar?v="]'),
    ).toHaveCount(0);
  });

  test('security: password and devices', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/profile/security');
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    // A wrong current password is refused, a mismatch is caught before sending.
    await page.getByLabel('Current password').fill('definitely-wrong-1A!');
    await page.getByLabel('New password', { exact: true }).fill(TEMP);
    await page.getByLabel('Repeat the new password').fill(TEMP + 'x');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/do not match|don.t match/i)).toBeVisible();
    await page.getByLabel('Repeat the new password').fill(TEMP);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/current password/i).last()).toBeVisible();

    // Devices: a second sign-in appears, and can be signed out from here.
    await expect(page.getByText('This device')).toBeVisible();
    const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const second = await other.newPage();
    await signIn(second);
    await page.reload();
    const rows = page
      .getByRole('region', { name: 'Where you are signed in' })
      .getByRole('listitem');
    await expect(page.getByText('This device')).toHaveCount(1);
    expect(await rows.count()).toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Sign out of all other devices' }).click();
    await expect(page.getByText('Signed out everywhere else')).toBeVisible();
    await expect(rows).toHaveCount(1);
    await other.close();

    // Change the password for real, sign in with it, and put the old one back.
    await page.getByLabel('Current password').fill(PASSWORD);
    await page.getByLabel('New password', { exact: true }).fill(TEMP);
    await page.getByLabel('Repeat the new password').fill(TEMP);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/Password changed/)).toBeVisible();
    await page.getByLabel('Current password').fill(TEMP);
    await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Repeat the new password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/Password changed/).first()).toBeVisible();
  });

  test('work details, no duplicated preferences, old addresses redirect', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.goto('/profile');
    const main = page.getByRole('main');

    // Language, theme and sounds live in the header, not on the profile page.
    await expect(main.getByText('The interface language')).toHaveCount(0);
    await expect(main.getByRole('radio', { name: 'Dark' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Preferences' })).toHaveCount(0);

    await main.getByLabel('Job title').fill('Product designer');
    await main.getByLabel('Phone').fill('+380 50 000 00 00');
    await main.getByLabel('Location').fill('Kyiv');
    await main.getByLabel('Time zone').fill('Mars/Olympus');
    await main.getByLabel('About you').fill('I draw boxes.');
    await main.getByRole('button', { name: 'Save changes' }).click();
    await expect(main.getByText(/Choose one of the available options/)).toBeVisible();
    await main.getByRole('button', { name: "Use this device's time zone" }).click();
    await main.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await expect(main.getByText('Product designer').first()).toBeVisible();

    // The values survive a reload; clear them again.
    await page.reload();
    await expect(main.getByLabel('Job title')).toHaveValue('Product designer');
    await expect(main.getByLabel('About you')).toHaveValue('I draw boxes.');
    for (const label of ['Job title', 'Phone', 'Location', 'Time zone', 'About you'])
      await main.getByLabel(label).fill('');
    await main.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();

    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    await page.goto('/settings/security');
    await expect(page).toHaveURL(/\/profile\/security$/);
    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/profile$/);
  });
});
