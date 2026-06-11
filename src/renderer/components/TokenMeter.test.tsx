import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Session } from '@shared/types';
import { TokenMeter } from './TokenMeter';

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
  usage: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
  sdkSessionId: '',
  turns: [],
};

describe('<TokenMeter>', () => {
  it('renders the total tokens and a USD estimate', () => {
    render(
      <TokenMeter
        session={{
          ...baseSession,
          usage: { input: 10_000, output: 2_000, cacheCreation: 0, cacheRead: 0 },
        }}
      />,
    );
    const btn = screen.getByTestId('token-meter');
    expect(btn).toHaveTextContent(/12K tok/);
    // Sonnet: 10K * $3/1M + 2K * $15/1M = 0.03 + 0.03 = $0.06
    expect(btn.textContent).toMatch(/\$0\.060/);
  });

  it('opens the usage popover on click and closes on the second click', async () => {
    const user = userEvent.setup();
    render(<TokenMeter session={baseSession} />);
    const btn = screen.getByTestId('token-meter');
    await user.click(btn);
    expect(screen.getByTestId('usage-popover')).toBeInTheDocument();
    await user.click(btn);
    expect(screen.queryByTestId('usage-popover')).not.toBeInTheDocument();
  });
});
