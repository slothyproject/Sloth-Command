/**
 * StatusBadge Component Tests
 */

import { render, screen } from '@/__tests__/utils/test-utils';
import { StatusBadge, StatusGroup, StatusIcon } from '@/app/components/ui';

describe('StatusBadge', () => {
  it('renders with default variant', () => {
    render(<StatusBadge status="healthy" />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<StatusBadge status="healthy" label="All Systems Green" />);
    expect(screen.getByText('All Systems Green')).toBeInTheDocument();
  });

  it('renders dot variant', () => {
    const { container } = render(<StatusBadge status="running" variant="dot" pulse />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders outline variant', () => {
    render(<StatusBadge status="critical" variant="outline" />);
    const badge = screen.getByText('Critical');
    expect(badge).toHaveClass('border');
  });

  it('renders subtle variant', () => {
    render(<StatusBadge status="warning" variant="subtle" />);
    const badge = screen.getByText('Warning');
    expect(badge).not.toHaveClass('bg-');
  });

  it('renders different sizes', () => {
    const { rerender } = render(<StatusBadge status="info" size="sm" />);
    let badge = screen.getByText('Info');
    expect(badge).toHaveClass('text-xs');

    rerender(<StatusBadge status="info" size="md" />);
    badge = screen.getByText('Info');
    expect(badge).toHaveClass('text-sm');

    rerender(<StatusBadge status="info" size="lg" />);
    badge = screen.getByText('Info');
    expect(badge).toHaveClass('text-base');
  });

  it('renders with pulse animation', () => {
    const { container } = render(<StatusBadge status="active" pulse />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders all status types correctly', () => {
    const statuses = [
      'healthy',
      'warning',
      'critical',
      'unknown',
      'offline',
      'success',
      'error',
      'info',
      'pending',
      'running',
      'completed',
      'failed',
      'cancelled',
      'approved',
      'open',
      'in_progress',
      'resolved',
      'dismissed',
      'active',
      'inactive',
    ] as const;

    statuses.forEach((status) => {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(/[A-Za-z]/)).toBeInTheDocument();
      unmount();
    });
  });
});

describe('StatusGroup', () => {
  it('renders multiple statuses', () => {
    const statuses = [
      { status: 'critical' as const, count: 2 },
      { status: 'warning' as const, count: 5 },
      { status: 'healthy' as const, count: 10 },
    ];

    render(<StatusGroup statuses={statuses} />);
    
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('skips zero count statuses', () => {
    const statuses = [
      { status: 'critical' as const, count: 2 },
      { status: 'warning' as const, count: 0 },
    ];

    render(<StatusGroup statuses={statuses} />);
    
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('StatusIcon', () => {
  it('renders with different sizes', () => {
    const { rerender, container } = render(<StatusIcon status="healthy" size="sm" />);
    expect(container.querySelector('.w-6')).toBeInTheDocument();

    rerender(<StatusIcon status="healthy" size="md" />);
    expect(container.querySelector('.w-8')).toBeInTheDocument();

    rerender(<StatusIcon status="healthy" size="lg" />);
    expect(container.querySelector('.w-10')).toBeInTheDocument();
  });

  it('renders with pulse animation', () => {
    const { container } = render(<StatusIcon status="running" pulse />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
