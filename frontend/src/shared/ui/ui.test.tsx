import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Pagination } from './Pagination';
import { PriorityPill, ProjectStatusPill, TaskStatusPill } from './Pill';
import { ProgressBar } from './ProgressBar';
import { SegmentedControl } from './SegmentedControl';
import { TH } from './Table';

describe('Button', () => {
  it('is disabled and busy while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('pills', () => {
  it('render translated labels', () => {
    render(
      <>
        <PriorityPill priority="high" />
        <TaskStatusPill status="in_review" />
        <ProjectStatusPill status="overdue" />
      </>,
    );
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('clamps and exposes the value', () => {
    render(<ProgressBar value={140} label="Progress" />);
    expect(screen.getByRole('progressbar', { name: 'Progress' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});

describe('SegmentedControl', () => {
  function Harness() {
    const [v, setV] = useState<'list' | 'kanban' | 'calendar'>('list');
    return (
      <SegmentedControl
        label="View"
        value={v}
        onChange={setV}
        options={[
          { value: 'list', label: 'List' },
          { value: 'kanban', label: 'Kanban' },
          { value: 'calendar', label: 'Calendar' },
        ]}
      />
    );
  }

  it('selects on click and with arrow keys (wrapping)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('radio', { name: 'Kanban' }));
    expect(screen.getByRole('radio', { name: 'Kanban' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Kanban' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Calendar' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Calendar' }), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Pagination', () => {
  it('shows the range summary and navigates', async () => {
    const onPage = vi.fn();
    render(<Pagination page={1} pageSize={20} total={100} onPageChange={onPage} />);
    expect(screen.getByText('Showing 1 to 20 of 100 entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe('TH', () => {
  it('reports sort state through aria-sort', () => {
    render(
      <table>
        <thead>
          <tr>
            <TH sortable sort="desc">
              Deadline
            </TH>
          </tr>
        </thead>
      </table>,
    );
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending');
  });
});
