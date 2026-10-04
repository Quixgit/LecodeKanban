import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './MetricCard';

describe('MetricCard trend', () => {
  it('shows the percentage when there is something to compare with', () => {
    render(<MetricCard title="Done" value={6} trend={50} trendLabel="vs before" />);
    expect(screen.getByText('50.00%')).toBeInTheDocument();
  });
  it('shows the fallback, never +0.00%, when there is nothing to compare with', () => {
    render(
      <MetricCard title="Done" value={6} trend={null} trendEmpty="New" trendLabel="vs before" />,
    );
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.queryByText(/0\.00%/)).toBeNull();
  });
  it('shows no trend line at all without a trend', () => {
    render(<MetricCard title="Open" value={3} caption="in review" />);
    expect(screen.getByText('in review')).toBeInTheDocument();
  });
});
