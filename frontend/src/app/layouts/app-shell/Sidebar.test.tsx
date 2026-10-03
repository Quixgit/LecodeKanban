import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { Sidebar } from './sidebar/Sidebar';
import { useSidebarStore } from './sidebarStore';

describe('Sidebar', () => {
  beforeEach(() => useSidebarStore.setState({ collapsed: false, expanded: ['tasks'] }));

  it('renders both menu sections with translated labels', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText('Main menu')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Integrations' })).toHaveAttribute(
      'href',
      '/integrations',
    );
  });

  it('marks the current route as active', () => {
    renderWithProviders(<Sidebar />, { route: '/projects' });
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
  });

  it('expands and collapses the Tasks submenu', async () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole('link', { name: 'In Review' })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Collapse Tasks' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(useSidebarStore.getState().expanded).not.toContain('tasks');
  });

  it('collapses to icons only', async () => {
    renderWithProviders(<Sidebar />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(useSidebarStore.getState().collapsed).toBe(true);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('link', { name: 'In Review' })).not.toBeInTheDocument();
  });

  it('opens the Tasks flyout on focus when collapsed and closes it with Escape', async () => {
    useSidebarStore.setState({ collapsed: true });
    renderWithProviders(<Sidebar />);
    const tasks = screen.getByRole('button', { name: 'Tasks' });
    tasks.focus();
    const menu = await screen.findByRole('menu', { name: 'Tasks' });
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(tasks).toHaveFocus();
  });
});
