import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Folder, Home } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette, filterCommands, useCommandPalette, type Command } from '.';

const make = (run = vi.fn()): Command[] => [
  { id: 'dash', label: 'Dashboard', group: 'Go to', icon: Home, run },
  { id: 'proj', label: 'Projects', group: 'Go to', icon: Folder, keywords: ['boards'], run },
];

describe('filterCommands', () => {
  it('matches label, keywords and is case-insensitive', () => {
    expect(filterCommands(make(), 'PROJ').map((c) => c.id)).toEqual(['proj']);
    expect(filterCommands(make(), 'boards').map((c) => c.id)).toEqual(['proj']);
    expect(filterCommands(make(), '')).toHaveLength(2);
  });
});

describe('CommandPalette', () => {
  it('opens with ⌘K / Ctrl+K and runs the highlighted command on Enter', async () => {
    const run = vi.fn();
    render(<CommandPalette commands={make(run)} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'proj');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');

    expect(run).toHaveBeenCalledTimes(1);
    expect(useCommandPalette.getState().isOpen).toBe(false);
  });
});
