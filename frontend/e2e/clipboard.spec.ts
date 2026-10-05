import { expect, signIn, test } from './fixtures';

test.describe('Copy buttons on a plain http address', () => {
  test('copying works without the clipboard API (the page is not a secure context)', async ({
    page,
  }) => {
    // What a deployment reached by http://<ip> looks like: no navigator.clipboard at all.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    expect(await page.evaluate(() => navigator.clipboard === undefined)).toBe(true);

    await page.goto('/team');
    await page
      .getByRole('button', { name: /Invite/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    const email = `copy-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await dialog.getByLabel('Email address').fill(email);
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    const link = await dialog.getByLabel('Invitation link').inputValue();
    expect(link).toContain('/invite/');

    await dialog.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Link copied', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Could not copy/i)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Done' }).click();

    // What was copied is really on the clipboard: paste it into a field.
    await page
      .getByRole('button', { name: /Invite/ })
      .first()
      .click();
    const field = page.getByRole('dialog').getByLabel('Email address');
    await field.click();
    await page.keyboard.press('Control+V');
    await expect(field).toHaveValue(link);
    await page.keyboard.press('Escape');

    // Clean up the pending invitation.
    await page.reload();
    await page
      .getByRole('button', { name: 'Revoke' })
      .first()
      .click()
      .catch(() => undefined);
  });
});
