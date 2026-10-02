import AxeBuilder from '@axe-core/playwright';
import { expect, openKanban, signIn, test } from './fixtures';

test.describe('Kanban board', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('has no horizontal page scroll and card meta never wraps', async ({ page }) => {
    await openKanban(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBe(0);
    const heights = await page.$$eval('article footer', (els) =>
      els.map((e) => e.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(0);
    for (const h of heights) expect(h).toBeLessThan(28); // one text line
  });

  test('column headers, lane titles and cards share the same left edge', async ({ page }) => {
    await openKanban(page, 'project');
    const edges = await page.evaluate(() => {
      const left = (el: Element | null) => Math.round(el?.getBoundingClientRect().left ?? -1);
      const chip = document.querySelector('[data-stuck]')!.firstElementChild!.firstElementChild!; // first column's status chip
      // First cell (first column) that holds a card, and the lane title right above it.
      const cell = [...document.querySelectorAll('section')]
        .map((s) => s.querySelector('.group\\/cell'))
        .find((c) => c?.querySelector('article'));
      return {
        chip: left(chip),
        lane: left(cell?.closest('section')?.querySelector('h2 button svg') ?? null),
        card: left(cell?.querySelector('article') ?? null),
      };
    });
    expect(Math.abs(edges.chip - edges.card)).toBeLessThanOrEqual(1);
    expect(Math.abs(edges.lane - edges.card)).toBeLessThanOrEqual(1);
  });

  test('cells of one swimlane have the same height, so "Add card" lines up', async ({ page }) => {
    await openKanban(page, 'project');
    const lanes = await page.$$eval('section', (sections) =>
      sections.map((s) =>
        [...s.querySelectorAll('.group\\/cell')].map((c) =>
          Math.round(c.getBoundingClientRect().height),
        ),
      ),
    );
    const withCells = lanes.filter((l) => l.length > 1);
    expect(withCells.length).toBeGreaterThan(0);
    for (const heights of withCells) expect(new Set(heights).size).toBe(1);
  });

  test('columns fill the width evenly', async ({ page }) => {
    await openKanban(page);
    const widths = await page.$$eval('.group\\/cell', (cells) =>
      cells.slice(0, 4).map((c) => Math.round(c.getBoundingClientRect().width)),
    );
    expect(new Set(widths).size).toBe(1);
    const board = await page
      .locator('.snap-x')
      .first()
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(board).toBeLessThanOrEqual(1); // fits: no horizontal scroll at 1440
  });

  test('passes axe colour-contrast and structure checks', async ({ page }) => {
    await openKanban(page);
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const summary = results.violations.map(
      (v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`,
    );
    expect(summary).toEqual([]);
  });
});
