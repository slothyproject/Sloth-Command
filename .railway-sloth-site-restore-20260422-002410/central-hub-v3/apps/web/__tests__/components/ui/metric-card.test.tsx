/**
 * MetricCard Component Tests
 */

import { render, screen } from '@/__tests__/utils/test-utils';
import { MetricCard, MetricGroup, StatCard } from '@/app/components/ui';

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(<MetricCard title="CPU Usage" value="78%" />);
    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  it('renders with subtitle', () => {
    render(<MetricCard title="CPU Usage" value="78%" subtitle="8 cores" />);
    expect(screen.getByText('8 cores')).toBeInTheDocument();
  });

  it('renders with trend up', () => {
    render(
      <MetricCard
        title="Revenue"
        value="$10,000"
        trend={{ direction: 'up', value: '12%', label: 'vs last month' }}
      />
    );
    expect(screen.getByText('↑ 12%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders with trend down', () => {
    render(
      <MetricCard
        title="Errors"
        value="5"
        trend={{ direction: 'down', value: '20%', label: 'vs yesterday' }}
      />
    );
    expect(screen.getByText('↓ 20%')).toBeInTheDocument();
  });

  it('renders with comparison', () => {
    render(
      <MetricCard
        title="Sales"
        value="150"
        comparison={{ current: 150, previous: 120, label: 'vs last week' }}
      />
    );
    expect(screen.getByText('25.0%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    const icon = <span data-testid="test-icon">Icon</span>;
    render(<MetricCard title="CPU" value="45%" icon={icon} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders with sparkline', () => {
    const data = [10, 20, 15, 25, 30, 35, 40];
    const { container } = render(
      <MetricCard title="CPU" value="45%" sparkline={data} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    const { user } = render(<MetricCard title="CPU" value="45%" onClick={handleClick} />);
    
    await user.click(screen.getByText('CPU').closest('div')!);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders loading state', () => {
    const { container } = render(<MetricCard title="CPU" value="45%" loading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders different sizes', () => {
    const { rerender } = render(<MetricCard title="CPU" value="45%" size="sm" />);
    expect(screen.getByText('45%')).toHaveClass('text-xl');

    rerender(<MetricCard title="CPU" value="45%" size="md" />);
    expect(screen.getByText('45%')).toHaveClass('text-2xl');

    rerender(<MetricCard title="CPU" value="45%" size="lg" />);
    expect(screen.getByText('45%')).toHaveClass('text-3xl');
  });

  it('renders different colors', () => {
    const colors = ['cyan', 'violet', 'green', 'red', 'yellow', 'slate'] as const;
    
    colors.forEach((color) => {
      const { unmount } = render(<MetricCard title="CPU" value="45%" color={color} />);
      expect(screen.getByText('CPU')).toBeInTheDocument();
      unmount();
    });
  });
});

describe('MetricGroup', () => {
  it('renders multiple metrics', () => {
    const metrics = [
      { label: 'CPU', value: '45%', trend: 'up' as const },
      { label: 'Memory', value: '60%', trend: 'down' as const },
      { label: 'Disk', value: '30%', trend: 'neutral' as const },
    ];

    render(<MetricGroup title="System" metrics={metrics} />);
    
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Disk')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Users" value={150} />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders with unit', () => {
    render(<StatCard label="Memory" value={16} unit="GB" />);
    expect(screen.getByText('GB')).toBeInTheDocument();
  });

  it('renders positive change', () => {
    render(<StatCard label="Revenue" value={1000} change={25} />);
    expect(screen.getByText('+25%')).toBeInTheDocument();
    expect(screen.getByText('+25%')).toHaveClass('text-green-400');
  });

  it('renders negative change', () => {
    render(<StatCard label="Errors" value={5} change={-10} />);
    expect(screen.getByText('-10%')).toBeInTheDocument();
    expect(screen.getByText('-10%')).toHaveClass('text-red-400');
  });
});
