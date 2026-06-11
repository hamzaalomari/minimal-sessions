import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@shared/types';
import { UsagePopover } from './UsagePopover';

const baseSession: Session = {
  id: 's1',
  name: 'demo',
  path: '~/dev/demo',
  model: 'claude-sonnet-4-6',
  systemPrompt: '',
  branch: 'main',
  createdAt: 0,
  lastActiveAt: 0,
  tokens: 0,
  usage: { input: 5_000, output: 2_500, cacheCreation: 1_000, cacheRead: 8_000 },
  sdkSessionId: '',
  turns: [],
};

describe('<UsagePopover>', () => {
  it('shows the model tier and $/1M rates in the header', () => {
    render(
      <UsagePopover
        anchor={{ left: 100, bottom: 40 }}
        session={baseSession}
        onClose={() => {}}
      />,
    );
    const pop = screen.getByTestId('usage-popover');
    expect(pop.textContent).toMatch(/Sonnet/);
    expect(pop.textContent).toMatch(/\$3/);
    expect(pop.textContent).toMatch(/\$15/);
  });

  it('lists input, output, cache-write and cache-read rows', () => {
    render(
      <UsagePopover
        anchor={{ left: 100, bottom: 40 }}
        session={baseSession}
        onClose={() => {}}
      />,
    );
    const pop = screen.getByTestId('usage-popover');
    expect(within(pop).getByText('Input')).toBeInTheDocument();
    expect(within(pop).getByText('Output')).toBeInTheDocument();
    expect(within(pop).getByText('Cache write')).toBeInTheDocument();
    expect(within(pop).getByText('Cache read')).toBeInTheDocument();
    expect(within(pop).getByText('Total')).toBeInTheDocument();
  });

  it('renders the total token count matching the usage sum', () => {
    render(
      <UsagePopover
        anchor={{ left: 100, bottom: 40 }}
        session={baseSession}
        onClose={() => {}}
      />,
    );
    // 5K + 2.5K + 1K + 8K = 16.5K → formatter rounds to integer K above 10K.
    expect(screen.getByTestId('usage-popover')).toHaveTextContent(/17K/);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <UsagePopover
        anchor={{ left: 100, bottom: 40 }}
        session={baseSession}
        onClose={onClose}
      />,
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalled();
  });
});
