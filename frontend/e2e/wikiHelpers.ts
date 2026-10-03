import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export const stamp = () => Date.now().toString(36);

/** Creates a private space through the UI. */
export async function createSpace(page: Page, name: string) {
  await page.goto('/docs');
  await page.getByRole('button', { name: 'New space' }).first().click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create space' }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  // The dialog hands focus back as it closes; wait for that so it can't steal an inline rename.
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Adds a node from the tree header and names it through the inline rename field. */
export async function addNode(page: Page, kind: 'page' | 'folder', title: string) {
  await page
    .getByRole('button', { name: kind === 'page' ? 'New page' : 'New folder', exact: true })
    .first()
    .click();
  const input = page.getByRole('textbox', { name: 'Page name' });
  await input.fill(title);
  await input.press('Enter');
  await expect(page.getByRole('treeitem', { name: new RegExp(title) })).toBeVisible();
}

export const level = (page: Page, title: string) =>
  page.getByRole('treeitem', { name: new RegExp(title) }).getAttribute('aria-level');

/** A fresh space with one empty page open in the editor. */
export async function openFreshPage(page: Page, title = 'Editor page') {
  await createSpace(page, `Ed ${stamp()}`);
  await addNode(page, 'page', title);
  const editor = page.getByRole('textbox', { name: 'Page content' });
  await expect(editor).toBeVisible({ timeout: 30_000 });
  return editor;
}

export const waitSaved = (page: Page) =>
  expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 15_000 });

/** A 1×1 PNG. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
