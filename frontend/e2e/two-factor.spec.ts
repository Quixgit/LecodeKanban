import AxeBuilder from '@axe-core/playwright';
import { createHmac } from 'node:crypto';
import { expect, test } from './fixtures';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 6238 code for a base32 secret, `shift` 30-second steps from now. */
function totp(secret: string, shift = 0): string {
  let bits = '';
  for (const c of secret.replace(/\s/g, '').toUpperCase())
    bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Math.floor(Date.now() / 30_000) + shift;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, '0');
}

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
