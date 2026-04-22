import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/app/components/layout/sidebar';

describe('Sidebar', () => {
  it('uses neutral secrets labels instead of vault branding', () => {
    render(<Sidebar />);

    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('Secrets Service')).toBeInTheDocument();
    expect(screen.queryByText('Secrets Vault')).not.toBeInTheDocument();
    expect(screen.queryByText('Token Vault')).not.toBeInTheDocument();
  });
});
