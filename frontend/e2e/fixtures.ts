import { test as base, expect, type Page } from '@playwright/test';

/** Demo account created by `make seed` (documented in backend/cmd/seed). */
const EMAIL = process.env.E2E_EMAIL ?? 'peter@demo.lecodekanban.test';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
export const LISA = 'lisa@demo.lecodekanban.test';

export async function signIn(
  page: Page,
  lang: 'en' | 'uk' = 'en',
  theme: 'light' | 'dark' = 'light',
  email: string = EMAIL,
) {
  if (!PASSWORD) throw new Error('Set E2E_PASSWORD (the seed password) — see `make e2e`.');
  await page.addInitScript(
    ([l, t]) => {
      localStorage.setItem('lk-lang', l);
      localStorage.setItem('lk-theme', JSON.stringify({ state: { preference: t }, version: 0 }));
    },
    [lang, theme] as const,
  );
  await page.goto('/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** Opens the Kanban view with the given swimlane mode. */
export async function openKanban(page: Page, swimlane: 'none' | 'project' = 'none') {
  await page.evaluate(
    (s) =>
      localStorage.setItem(
        'lk-kanban',
        JSON.stringify({
          state: { view: 'kanban', swimlane: s, collapsed: [], collapsedLanes: [] },
          version: 0,
        }),
      ),
    swimlane,
  );
  await page.goto('/tasks');
  await expect(page.locator('article').first()).toBeVisible();
}

export const test = base;
export { expect };
