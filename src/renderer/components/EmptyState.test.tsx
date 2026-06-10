import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@shared/types';
import { EmptyState } from './EmptyState';

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
  turns: [],
};

describe('<EmptyState>', () => {
  it('renders the heading, model name and path', () => {
    render(<EmptyState session={session} onSuggest={() => {}} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Start a conversation');
    expect(screen.getByText(/Claude Sonnet 4\.6 is ready/)).toBeInTheDocument();
    expect(screen.getByText('~/dev/demo')).toBeInTheDocument();
  });

  it('renders three suggestion chips', () => {
    render(<EmptyState session={session} onSuggest={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('calls onSuggest with the chip text when clicked', async () => {
    const onSuggest = vi.fn();
    const user = userEvent.setup();
    render(<EmptyState session={session} onSuggest={onSuggest} />);
    await user.click(screen.getByRole('button', { name: /explain the structure/i }));
    expect(onSuggest).toHaveBeenCalledWith('Explain the structure of this codebase');
  });

  it('falls back to the raw model id when the model is unknown', () => {
    render(<EmptyState session={{ ...session, model: 'claude-mystery-9-9' }} onSuggest={() => {}} />);
    expect(screen.getByText(/claude-mystery-9-9 is ready/)).toBeInTheDocument();
  });
});
