import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

import { totp } from './totp';

test.describe('Two-step verification', () => {
  test('turn on, sign in with a code and a recovery code, turn off', async ({ page }) => {
    const email = `mfa-${Date.now().toString(36)}@example.com`;
    const password = 'Kanban-Board-2026';
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => localStorage.setItem('lk-lang', 'en'));

    // A fresh account, so the shared demo user is never locked behind a code.
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Mfa Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/register'));

    await page.goto('/profile/security');
    const card = page.getByRole('region', { name: 'Two-step verification' });
    await expect(card.getByText('Two-step verification is off')).toBeVisible();
    await card.getByRole('button', { name: 'Turn on' }).click();

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeVisible();
    const secret = (await dialog.locator('code').first().innerText()).trim();
    const axe = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    await dialog.getByLabel('6-digit code').fill('000000');
    await dialog.getByRole('button', { name: 'Turn on' }).click();
    await expect(dialog.getByText('That code is not valid')).toBeVisible();
    await dialog.getByLabel('6-digit code').fill(totp(secret));
    await dialog.getByRole('button', { name: 'Turn on' }).click();

    const list = page.getByRole('list', { name: 'Your recovery codes' });
    await expect(list.locator('li')).toHaveCount(8);
    const codes = await list.locator('li').allInnerTexts();
    expect(codes).toHaveLength(8);
    await page.getByRole('button', { name: 'I have saved them' }).click();
    await expect(card.getByText('8 recovery codes left')).toBeVisible();

    // Sign out; the password alone no longer opens the account.
    await page.context().clearCookies();
    await page.goto('/login');
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
    await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // A wrong code fails; the next 30-second step's code works (the enabling step is spent).
    await page.getByLabel('Verification code').fill('111111');
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page.getByText('That code is not valid')).toBeVisible();
    await page.getByLabel('Verification code').fill(totp(secret, 1));
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));

    // A recovery code signs in once.
    await page.context().clearCookies();
    await page.goto('/login');
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
    await page.getByLabel('Verification code').fill(codes[0]!);
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'));

    // Turning it off asks for the password and a code.
    await page.goto('/profile/security');
    await expect(card.getByText('7 recovery codes left')).toBeVisible();
    await card.getByRole('button', { name: 'Turn off' }).click();
    const off = page.getByRole('dialog');
    await off.getByLabel('Current password').fill(password);
    await off.getByLabel('Code from the app, or a recovery code').fill(codes[1]!);
    await off.getByRole('button', { name: 'Turn off' }).click();
    await expect(card.getByText('Two-step verification is off')).toBeVisible();
  });
});

test.describe('Workspace requires two-step verification', () => {
  test('the owner turns it on, a member without it is held at the door', async ({ page }) => {
    const email = `req-${Date.now().toString(36)}@example.com`;
    const password = 'Kanban-Board-2026';
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => localStorage.setItem('lk-lang', 'en'));
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Req Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/register'));

    // Requiring it needs the owner to have it first.
    await page.goto('/settings/access');
    const main = page.getByRole('main');
    await main.getByRole('switch', { name: 'Require two-step verification' }).click();
    await expect(
      page
        .getByText('Turn on two-step verification for yourself first')
        .or(page.getByText(/requires two-step verification/i))
        .first(),
    ).toBeVisible();

    await page.goto('/profile/security');
    const card = page.getByRole('region', { name: 'Two-step verification' });
    await card.getByRole('button', { name: 'Turn on' }).click();
    const dialog = page.getByRole('dialog');
    const secret = (await dialog.locator('code').first().innerText()).trim();
    await dialog.getByLabel('6-digit code').fill(totp(secret));
    await dialog.getByRole('button', { name: 'Turn on' }).click();
    await page.getByRole('button', { name: 'I have saved them' }).click();

    await page.goto('/settings/access');
    await main.getByRole('switch', { name: 'Require two-step verification' }).click();
    await expect(main.getByRole('switch', { name: 'Require two-step verification' })).toBeChecked();

    // Turning their own factor off leaves them without it: the workspace closes behind them.
    await page.goto('/profile/security');
    await card.getByRole('button', { name: 'Turn off' }).click();
    const off = page.getByRole('dialog');
    await off.getByLabel('Current password').fill(password);
    await off.getByLabel('Code from the app, or a recovery code').fill(totp(secret, 1));
    await off.getByRole('button', { name: 'Turn off' }).click();
    await expect(card.getByText('Two-step verification is off')).toBeVisible();

    await page.goto('/tasks');
    await expect(
      page.getByRole('heading', { name: /asks for two-step verification/ }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Turn on two-step verification' }).click();
    await expect(page).toHaveURL(/\/profile\/security$/);
  });
});
