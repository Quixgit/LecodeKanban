import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { TaskFilters } from '../model/filters';
import { TasksToolbar } from './TasksToolbar';

const base: TaskFilters = { q: '', page: 1, showAll: false };

function toolbar(filters: TaskFilters, update = vi.fn()) {
  return (
    <TasksToolbar
      filters={filters}
      update={update}
      clear={vi.fn()}
      activeCount={0}
      projects={[]}
      members={[]}
      currentUserId="u1"
      canCreate={false}
      onCreate={vi.fn()}
    />
  );
}

describe('TasksToolbar search', () => {
  it('debounces typing into a single update', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const update = vi.fn();
    renderWithProviders(toolbar(base, update));
    await userEvent.type(screen.getByRole('textbox'), 'abc');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ q: 'abc' });
    vi.useRealTimers();
  });

  it('follows the filters when they are cleared from outside', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const update = vi.fn();
    const { rerender } = renderWithProviders(toolbar({ ...base, q: 'bug' }, update));
    expect(screen.getByRole('textbox')).toHaveValue('bug');
    rerender(toolbar({ ...base, q: '' }, update));
    expect(screen.getByRole('textbox')).toHaveValue('');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(update).not.toHaveBeenCalled(); // must not re-apply the stale text
    vi.useRealTimers();
  });
});
