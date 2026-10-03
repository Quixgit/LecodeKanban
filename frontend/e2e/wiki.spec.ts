import AxeBuilder from '@axe-core/playwright';
import { expect, LISA, signIn, test } from './fixtures';
import { addNode, createSpace, level, stamp } from './wikiHelpers';

test.describe('Docs', () => {
  test('folder → nested page → share → other user → move → trash → restore', async ({
    page,
    browser,
  }) => {
    await signIn(page);
    const space = `E2E ${stamp()}`;
    const title = `Failover ${stamp()}`;
    await createSpace(page, space);

    await addNode(page, 'folder', 'Playbooks');
    // A child page via the row's "+" action.
    const folder = page.getByRole('treeitem', { name: /Playbooks/ });
    await folder.hover();
    await folder.getByRole('button', { name: /Add a page inside Playbooks/ }).click();
    const input = page.getByRole('textbox', { name: 'Page name' });
    await input.fill(title);
    await input.press('Enter');
    await expect(page.getByRole('treeitem', { name: new RegExp(title) })).toBeVisible();
    expect(await level(page, title)).toBe('2');
    const pageUrl = page.url();
    expect(pageUrl).toMatch(/\/docs\/p\//);

    // Lisa has no access yet: the page looks absent.
    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto(pageUrl);
    await expect(lisa.getByText("We couldn't open this page")).toBeVisible();

    // Share the page with her as a viewer.
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Add a person' }).click();
    await page.getByRole('option', { name: 'Lisa Kim' }).click();
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(dialog.getByText('Lisa Kim')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();

    await lisa.goto(pageUrl);
    await expect(lisa.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    // Her tree shows the shared page on its own (the folder above stays hidden).
    await expect(lisa.getByRole('treeitem', { name: new RegExp(title) })).toBeVisible();
    await expect(lisa.getByRole('treeitem', { name: /Playbooks/ })).toHaveCount(0);
    await expect(lisa.getByRole('textbox', { name: 'Page title' })).toHaveCount(0); // read-only

    // Move out of the folder with the keyboard (Alt+←), then back into it (Alt+→ is "indent").
    const tree = page.getByRole('tree');
    await tree.focus();
    await page.getByRole('treeitem', { name: new RegExp(title) }).click();
    await tree.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect.poll(() => level(page, title)).toBe('1');

    // Delete (trash) and restore.
    await tree.focus();
    await page.keyboard.press('Delete');
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('treeitem', { name: new RegExp(title) })).toHaveCount(0);
    await page.getByRole('link', { name: 'Trash' }).click();
    const trashed = page.getByRole('listitem').filter({ hasText: title });
    await expect(trashed).toBeVisible();
    await trashed.getByRole('button', { name: 'Restore' }).click();
    await expect(trashed).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole('treeitem', { name: new RegExp(title) })).toBeVisible();

    await lisaCtx.close();
  });

  test('drag a page onto another to nest it, and the tree stays keyboard-navigable', async ({
    page,
  }) => {
    await signIn(page);
    await createSpace(page, `DnD ${stamp()}`);
    await addNode(page, 'page', 'Alpha');
    await addNode(page, 'page', 'Beta');

    const alpha = page.getByRole('treeitem', { name: /Alpha/ });
    const beta = page.getByRole('treeitem', { name: /Beta/ });
    const a = (await alpha.boundingBox())!;
    const b = (await beta.boundingBox())!;
    await page.mouse.move(b.x + 80, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + 80, b.y - 4, { steps: 4 });
    await page.mouse.move(a.x + 80, a.y + a.height / 2, { steps: 8 }); // middle of Alpha = "inside"
    await page.mouse.up();

    // The target opens so the dropped page stays in view.
    await expect(page.getByRole('treeitem', { name: /Beta/ })).toBeVisible();
    await expect.poll(() => level(page, 'Beta')).toBe('2');

    // Arrow keys walk the tree; the active descendant follows.
    const tree = page.getByRole('tree');
    await tree.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    const active = await tree.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    await expect(page.locator(`#${active}`)).toContainText('Beta');
  });

  test('has no axe violations on the space page and the share dialog', async ({ page }) => {
    await signIn(page);
    await page.goto('/docs');
    await expect(page.getByRole('tree')).toBeVisible();
    const scan = async () => {
      const results = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      return results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    };
    expect(await scan()).toEqual([]);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await scan()).toEqual([]);
  });
});
