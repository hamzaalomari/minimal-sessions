import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Turn as TurnT } from '@shared/types';
import { Turn } from './Turn';

const userTurn: TurnT = {
  id: 't1',
  role: 'user',
  blocks: [{ type: 'p', text: 'hello' }],
  createdAt: 0,
};

const asstTurn: TurnT = {
  id: 't2',
  role: 'assistant',
  blocks: [{ type: 'p', text: 'hi back' }],
  modelShort: 'Sonnet',
  createdAt: 0,
};

describe('<Turn>', () => {
  it('renders a user turn with the user role and badge', () => {
    const { container } = render(<Turn turn={userTurn} />);
    expect(container.querySelector('.turn.user')).not.toBeNull();
    expect(container.querySelector('.role-badge.user')).not.toBeNull();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders an assistant turn with the asst badge and modelShort', () => {
    const { container } = render(<Turn turn={asstTurn} />);
    expect(container.querySelector('.turn.assistant')).not.toBeNull();
    expect(container.querySelector('.role-badge.asst')).not.toBeNull();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();
  });

  it('renders all blocks in the turn body', () => {
    const turn: TurnT = {
      id: 't3',
      role: 'assistant',
      blocks: [
        { type: 'p', text: 'first' },
        { type: 'h', text: 'A heading' },
        { type: 'p', text: 'second' },
      ],
      createdAt: 0,
    };
    const { container } = render(<Turn turn={turn} />);
    expect(container.querySelectorAll('.turn-body p')).toHaveLength(2);
    expect(container.querySelector('.turn-body h4')?.textContent).toBe('A heading');
  });

  it('omits the modelShort sub when not provided', () => {
    render(<Turn turn={userTurn} />);
    expect(screen.queryByText('Sonnet')).not.toBeInTheDocument();
  });
});
