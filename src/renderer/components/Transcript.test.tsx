import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Session, Turn } from '@shared/types';
import { Transcript } from './Transcript';

function makeTurn(id: string, role: 'user' | 'assistant', text: string): Turn {
  return { id, role, blocks: [{ type: 'p', text }], createdAt: 0 };
}

const session: Session = {
  id: 's1',
  name: 'demo',
  model: 'claude-sonnet-4-6',
  systemPrompt: '',
  path: '~/dev/demo',
  branch: 'main',
  createdAt: 0,
  lastActiveAt: 0,
  tokens: 0,
  turns: [
    makeTurn('t1', 'user', 'first user message'),
    makeTurn('t2', 'assistant', 'first assistant message'),
  ],
};

describe('<Transcript>', () => {
  it('renders the session head', () => {
    render(<Transcript session={session} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('demo');
  });

  it('renders all turns in order', () => {
    const { container } = render(<Transcript session={session} />);
    const turns = container.querySelectorAll('.turn');
    expect(turns).toHaveLength(2);
    expect(turns[0]?.textContent).toContain('first user message');
    expect(turns[1]?.textContent).toContain('first assistant message');
  });

  it('renders the typing indicator when typing is true', () => {
    render(<Transcript session={session} typing />);
    expect(screen.getByTestId('typing')).toBeInTheDocument();
  });

  it('omits the typing indicator by default', () => {
    render(<Transcript session={session} />);
    expect(screen.queryByTestId('typing')).not.toBeInTheDocument();
  });

  it('renders an empty turn list cleanly when the session has no turns', () => {
    const empty = { ...session, turns: [] };
    const { container } = render(<Transcript session={empty} />);
    expect(container.querySelectorAll('.turn')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
