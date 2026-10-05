import AxeBuilder from '@axe-core/playwright';
import { expect, openKanban, signIn, test } from './fixtures';

test.describe('Trash', () => {
  test('a deleted task waits in the trash and can be restored', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await openKanban(page);

    // Make a task to delete, via the API (a quick, isolated one).
    const title = `Trash me ${Date.now().toString(36)}`;
    const made = await page.evaluate(async (t) => {
      const csrf = decodeURIComponent(
        document.cookie
          .split('; ')
          .find((c) => c.startsWith('lk_csrf='))
          ?.slice(8) ?? '',
      );
      const h = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
      const wss = (await (
        await fetch('/api/v1/workspaces', { credentials: 'include' })
      ).json()) as { id: string }[];
      const projects = (await (
        await fetch(`/api/v1/workspaces/${wss[0]!.id}/projects?pageSize=1`, {
          credentials: 'include',
        })
      ).json()) as { items: { id: string }[] };
      const res = await fetch(`/api/v1/workspaces/${wss[0]!.id}/cards`, {
        method: 'POST',
        credentials: 'include',
        headers: h,
        body: JSON.stringify({ projectId: projects.items[0]!.id, title: t }),
      });
      const card = (await res.json()) as { id: string };
      await fetch(`/api/v1/cards/${card.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: h,
      });
      return card.id;
    }, title);
    expect(made).toBeTruthy();

    await page.goto('/trash');
    const main = page.getByRole('main');
    await expect(main.getByText(title)).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

    await main
      .getByRole('listitem')
      .filter({ hasText: title })
      .getByRole('button', { name: 'Restore' })
      .click();
    await expect(page.getByText(`“${title}” is back`)).toBeVisible();
    await expect(main.getByText(title)).toHaveCount(0);

    // It is a live task again.
    await page.goto('/tasks');
    await expect(page.getByText(title).first()).toBeVisible();
  });
});
