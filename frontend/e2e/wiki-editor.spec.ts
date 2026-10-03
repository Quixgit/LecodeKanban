import AxeBuilder from '@axe-core/playwright';
import { expect, LISA, signIn, test } from './fixtures';
import { PNG, addNode, openFreshPage, stamp, waitSaved } from './wikiHelpers';

test.describe('Docs editor', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('Markdown shortcuts, links, lists and tasks become real formatting and autosave', async ({
    page,
  }) => {
    const editor = await openFreshPage(page);
    await editor.click();
    await page.keyboard.type('# Failover guide\n');
    await page.keyboard.type(
      'Use **bold**, *italic*, `code` and [docs](https://example.com/docs) here.\n',
    );
    await page.keyboard.type('> a quote\n\n');
    await page.keyboard.type('1. first\nsecond\n\n');
    await page.keyboard.type('[] write the postmortem\n');

    await expect(editor.locator('h1')).toHaveText('Failover guide');
    await expect(editor.locator('strong')).toHaveText('bold');
    await expect(editor.locator('em')).toHaveText('italic');
    await expect(editor.locator('p code')).toHaveText('code');
    await expect(editor.locator('a[href="https://example.com/docs"]')).toHaveText('docs');
    await expect(editor.locator('blockquote')).toContainText('a quote');
    await expect(editor.locator('ol li')).toHaveCount(2);
    // Enter in a task list opens the next item, so there are two: the typed one and an empty one.
    await expect(editor.locator('ul[data-type="taskList"] li').first()).toContainText(
      'write the postmortem',
    );

    // Heading shows up in the outline; autosave persists across a reload.
    await expect(page.getByRole('navigation', { name: 'On this page' })).toContainText(
      'Failover guide',
    );
    await waitSaved(page);
    await page.reload();
    const again = page.getByRole('textbox', { name: 'Page content' });
    await expect(again.locator('h1')).toHaveText('Failover guide', { timeout: 30_000 });
    await expect(again.locator('a[href="https://example.com/docs"]')).toBeVisible();
  });

  test('slash menu inserts a table, a callout and a highlighted code block with a live Mermaid diagram', async ({
    page,
  }) => {
    const editor = await openFreshPage(page);
    await editor.click();

    await page.keyboard.type('/table');
    await expect(page.getByRole('option', { name: /Table/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(editor.locator('table')).toBeVisible();
    await expect(editor.locator('table tr')).toHaveCount(3);
    await page.keyboard.press('ArrowDown'); // leave the table through the trailing paragraph
    await editor
      .locator('table')
      .locator('xpath=following::p[1]')
      .click()
      .catch(() => undefined);

    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n/warning');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Mind the replication lag');
    await expect(editor.locator('[data-callout="warning"]')).toContainText(
      'Mind the replication lag',
    );

    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n/diagram');
    await page.keyboard.press('Enter');
    await expect(editor.locator('.lk-codeblock select')).toHaveValue('mermaid');
    await expect(editor.locator('.lk-mermaid svg')).toBeVisible({ timeout: 30_000 });

    // Switch the block to Bash: it is highlighted and has a copy button.
    await editor.locator('.lk-codeblock select').selectOption('bash');
    await expect(editor.locator('.lk-mermaid')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
    await waitSaved(page);
  });

  test('pasted Markdown becomes blocks, and an unsafe link is refused', async ({ page }) => {
    const editor = await openFreshPage(page);
    await editor.click();
    const md =
      '## Rollout\n\n- step one\n- step two\n\n```bash\nkubectl rollout status deploy/api\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    await page.evaluate((text) => {
      const el = document.querySelector('.lk-prose')!;
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      el.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    }, md);
    await expect(editor.locator('h2')).toHaveText('Rollout');
    await expect(editor.locator('ul li')).toHaveCount(2);
    await expect(editor.locator('.lk-codeblock')).toContainText('kubectl rollout status');
    await expect(editor.locator('table')).toBeVisible();

    // Link dialog: javascript: is rejected with a message, https works.
    await editor.locator('h2').click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('javascript:alert(1)');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog.getByText(/http, https, mailto or tel/)).toBeVisible();
    await dialog.getByRole('textbox').fill('example.com/runbook');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(editor.locator('a[href="https://example.com/runbook"]').first()).toBeVisible();
    await waitSaved(page);
  });

  test('uploads an image from the slash menu and keeps it after a reload', async ({ page }) => {
    const editor = await openFreshPage(page);
    await editor.click();
    await page.keyboard.type('/image');
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooser).setFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: PNG });
    const img = editor.locator('img[alt="diagram.png"]');
    await expect(img).toBeVisible({ timeout: 15_000 });
    await expect(img).toHaveAttribute(
      'src',
      /\/api\/v1\/wiki\/files\/[0-9a-f-]{36}\/content\?inline=true/,
    );
    await waitSaved(page);
    await page.reload();
    await expect(
      page.getByRole('textbox', { name: 'Page content' }).locator('img[alt="diagram.png"]'),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('exports Markdown and imports it back into another page', async ({ page }) => {
    const editor = await openFreshPage(page, 'Source page');
    await editor.click();
    await page.keyboard.type('## Exported\n');
    await page.keyboard.type('- alpha\nbeta');
    await waitSaved(page);
    await page.getByRole('button', { name: 'More actions' }).last().click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Download as Markdown' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('Source page.md');
    const text = await (
      await import('node:fs/promises')
    ).readFile((await download.path())!, 'utf8');
    expect(text).toContain('## Exported');
    expect(text).toMatch(/- alpha\n- beta/);

    await addNode(page, 'page', 'Target page');
    const target = page.getByRole('textbox', { name: 'Page content' });
    await expect(target).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue('Target page');
    const importItem = page.getByRole('menuitem', { name: 'Import Markdown file…' });
    // The page header re-renders while the new page loads; reopen the menu until it sticks.
    await expect(async () => {
      if (!(await importItem.isVisible())) {
        await page.getByRole('button', { name: 'More actions' }).last().click();
      }
      await expect(importItem).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    const chooser = page.waitForEvent('filechooser');
    await importItem.click();
    await (
      await chooser
    ).setFiles({ name: 'in.md', mimeType: 'text/markdown', buffer: Buffer.from(text) });
    await expect(target.locator('h2')).toHaveText('Exported');
    await expect(target.locator('ul li')).toHaveCount(2);
  });

  test('page properties, verification and templates', async ({ page }) => {
    await openFreshPage(page, 'Props page');
    await page.getByRole('button', { name: 'Page properties' }).click();
    const props = page.getByRole('region', { name: 'Page properties' });
    await props.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Published' }).click();
    await props.getByPlaceholder('Add a tag and press Enter').fill('ops');
    await page.keyboard.press('Enter');
    await expect(props.getByText('ops', { exact: true })).toBeVisible();
    await props.getByRole('button', { name: 'Mark as verified' }).click();
    await expect(props.getByText(/Verified /)).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Page properties' }).click();
    await expect(
      page.getByRole('region', { name: 'Page properties' }).getByText('ops', { exact: true }),
    ).toBeVisible();

    // New page from the built-in Postmortem template (Peter is the workspace owner: he can also save templates).
    await page.getByRole('button', { name: 'New from template' }).click();
    await page.getByRole('radio', { name: /Postmortem/ }).click();
    await page.getByRole('button', { name: 'Use template' }).click();
    const editor = page.getByRole('textbox', { name: 'Page content' });
    await expect(editor.locator('h2', { hasText: 'Timeline' })).toBeVisible({ timeout: 30_000 });
    await expect(editor.locator('[data-callout="warning"]')).toBeVisible();

    await page.getByRole('button', { name: 'More actions' }).last().click();
    await page.getByRole('menuitem', { name: 'Save as template…' }).click();
    await page.getByLabel('Template name').fill(`House postmortem ${stamp()}`);
    await page.getByRole('button', { name: 'Save template' }).click();
    await expect(page.getByText(/House postmortem .* saved/)).toBeVisible();
  });

  test('works offline, then saves; a second writer gets a conflict choice', async ({
    page,
    browser,
    context,
  }) => {
    const editor = await openFreshPage(page, 'Conflict page');
    await editor.click();
    await page.keyboard.type('first draft');
    await waitSaved(page);

    await context.setOffline(true);
    await page.keyboard.type(' typed offline');
    await expect(page.getByRole('status').filter({ hasText: 'Offline' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await context.setOffline(false);
    await waitSaved(page);

    // Share with Lisa as an editor; she saves first, so Peter's next save conflicts.
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const share = page.getByRole('dialog');
    await share.getByRole('combobox', { name: 'Add a person' }).click();
    await page.getByRole('option', { name: 'Lisa Kim' }).click();
    await share.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Editor' }).click();
    await share.getByRole('button', { name: 'Add' }).click();
    await expect(share.getByText('Lisa Kim')).toBeVisible();
    await share.getByRole('button', { name: 'Done' }).click();

    const lisaCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const lisa = await lisaCtx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto(page.url());
    const lisaEditor = lisa.getByRole('textbox', { name: 'Page content' });
    await expect(lisaEditor).toContainText('typed offline', { timeout: 30_000 });
    await lisaEditor.click();
    await lisa.keyboard.press('Control+End');
    await lisa.keyboard.type(' LISA WAS HERE');
    await waitSaved(lisa);

    await editor.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' and Peter too');
    const banner = page.getByRole('alert').filter({ hasText: 'Someone else changed this page' });
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.getByRole('button', { name: 'Load their version' }).click();
    await expect(editor).toContainText('LISA WAS HERE');
    await expect(banner).toHaveCount(0);
    await lisaCtx.close();
  });

  test('a reader sees the page without editing tools', async ({ page, browser }) => {
    const editor = await openFreshPage(page, 'Read only page');
    await editor.click();
    await page.keyboard.type('Only Peter edits this');
    await waitSaved(page);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const share = page.getByRole('dialog');
    await share.getByRole('combobox', { name: 'Add a person' }).click();
    await page.getByRole('option', { name: 'Lisa Kim' }).click();
    await share.getByRole('button', { name: 'Add' }).click(); // viewer by default
    await expect(share.getByText('Lisa Kim')).toBeVisible();
    await share.getByRole('button', { name: 'Done' }).click();

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const lisa = await ctx.newPage();
    await signIn(lisa, 'en', 'light', LISA);
    await lisa.goto(page.url());
    const view = lisa.getByRole('textbox', { name: 'Page content' });
    await expect(view).toContainText('Only Peter edits this', { timeout: 30_000 });
    await expect(view).toHaveAttribute('contenteditable', 'false');
    await expect(lisa.getByRole('toolbar', { name: 'Formatting' })).toHaveCount(0);
    await expect(lisa.getByText('You can read this page but not edit it')).toBeVisible();
    await ctx.close();
  });

  test('has no axe violations in the editor, the slash menu and the shortcuts dialog', async ({
    page,
  }) => {
    const editor = await openFreshPage(page, 'A11y page');
    await editor.click();
    await page.keyboard.type('# Title\nSome text\n');
    await waitSaved(page);
    const scan = async () => {
      const r = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      return r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    };
    expect(await scan()).toEqual([]);
    await page.keyboard.type('/');
    await expect(page.getByRole('listbox', { name: 'Insert a block' })).toBeVisible();
    expect(await scan()).toEqual([]);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await scan()).toEqual([]);
  });
});
