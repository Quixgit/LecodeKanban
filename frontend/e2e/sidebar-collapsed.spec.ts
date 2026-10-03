import { mkdirSync } from 'node:fs';
import { expect, signIn, test } from './fixtures';

const OUT = '../docs/qa/sidebar-collapsed';
const WIDTHS = [1440, 1024] as const;
const THEMES = ['light', 'dark'] as const;
const LANGS = ['uk', 'en'] as const;

test.describe('Collapsed sidebar', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  for (const width of WIDTHS)
    for (const theme of THEMES)
      for (const lang of LANGS) {
        test(`icons and active highlight are centred (${width}, ${theme}, ${lang})`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.addInitScript(() =>
            localStorage.setItem(
              'lk-sidebar',
              JSON.stringify({ state: { collapsed: true, expanded: [] }, version: 0 }),
            ),
          );
          await signIn(page, lang, theme);
          await page.goto('/projects');

          const rail = page.getByRole('complementary');
          await expect(rail).toBeVisible();
          // Wait for the width animation to settle.
          await expect.poll(async () => Math.round((await rail.boundingBox())!.width)).toBe(77);

          const { centers, railCenter } = await rail.evaluate((el) => {
            const cx = (e: Element) => {
              const r = e.getBoundingClientRect();
              return r.x + r.width / 2;
            };
            const box = el.getBoundingClientRect();
            return {
              // Centre of the area inside the 1px right border.
              railCenter: box.x + el.clientLeft + el.clientWidth / 2,
              centers: {
                icons: [...el.querySelectorAll('nav svg')].map(cx),
                highlight: [...el.querySelectorAll('nav [aria-hidden="true"].absolute')].map(cx),
              },
            };
          });
          expect(centers.icons.length).toBeGreaterThan(5);
          expect(centers.highlight.length).toBe(1);
          for (const x of [...centers.icons, ...centers.highlight])
            expect(Math.abs(x - railCenter)).toBeLessThanOrEqual(0.5);

          await page.screenshot({
            path: `${OUT}/collapsed-${theme}-${lang}-${width}.png`,
            clip: { x: 0, y: 0, width: 320, height: 900 },
          });
        });
      }

  test('Tasks flyout opens on focus, lists statuses and closes with Escape', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'lk-sidebar',
        JSON.stringify({ state: { collapsed: true, expanded: [] }, version: 0 }),
      ),
    );
    await signIn(page, 'en');
    await page.goto('/projects');
    const tasks = page.getByRole('button', { name: 'Tasks' });
    await tasks.focus();
    const menu = page.getByRole('menu', { name: 'Tasks' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(tasks).toBeFocused();
  });
});
