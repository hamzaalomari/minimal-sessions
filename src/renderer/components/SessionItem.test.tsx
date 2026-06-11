import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@shared/types';
import { SessionItem } from './SessionItem';

const NOW = Date.now();

const baseSession: Session = {
  id: 's1',
  name: 'auth refactor',
  path: '~/dev/acme/auth-service',
  model: 'claude-sonnet-4-6',
  systemPrompt: '',
  branch: 'main',
  createdAt: NOW - 3_600_000,
  lastActiveAt: NOW - 2 * 60_000,
  tokens: 12_300,
  turns: [
    {
      id: 't1',
      role: 'user',
      blocks: [{ type: 'p', text: 'hi' }],
      createdAt: NOW,
    },
  ],
};

describe('<SessionItem />', () => {
  it('shows name, path, model short, message count, and relative time', () => {
    render(
      <SessionItem
        session={baseSession}
        active={false}
        renaming={false}
        onSelect={() => {}}
        onRenameCommit={() => {}}
      />,
    );
    expect(screen.getByText('auth refactor')).toBeInTheDocument();
    expect(screen.getByText('~/dev/acme/auth-service')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();
    expect(screen.getByText('· 1 message')).toBeInTheDocument();
    expect(screen.getByText('2m')).toBeInTheDocument();
  });

  it('pluralizes the message count', () => {
    render(
      <SessionItem
        session={{ ...baseSession, turns: [...baseSession.turns, baseSession.turns[0]!] }}
        active={false}
        renaming={false}
        onSelect={() => {}}
        onRenameCommit={() => {}}
      />,
    );
    expect(screen.getByText('· 2 messages')).toBeInTheDocument();
  });

  it('adds the active class when active', () => {
    const { container } = render(
      <SessionItem
        session={baseSession}
        active
        renaming={false}
        onSelect={() => {}}
        onRenameCommit={() => {}}
      />,
    );
    expect(container.querySelector('.session-item')).toHaveClass('active');
  });

  it('fires onSelect on row click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionItem
        session={baseSession}
        active={false}
        renaming={false}
        onSelect={onSelect}
        onRenameCommit={() => {}}
      />,
    );
    await user.click(screen.getByText('auth refactor'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders an input when renaming and commits on Enter', async () => {
    const onRenameCommit = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionItem
        session={baseSession}
        active={false}
        renaming
        onSelect={() => {}}
        onRenameCommit={onRenameCommit}
      />,
    );
    const input = screen.getByRole('textbox', { name: /rename session/i });
    await user.clear(input);
    await user.type(input, 'renamed{Enter}');
    expect(onRenameCommit).toHaveBeenCalledWith('renamed');
  });

  it('cancels rename on Escape', async () => {
    const onRenameCommit = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionItem
        session={baseSession}
        active={false}
        renaming
        onSelect={() => {}}
        onRenameCommit={onRenameCommit}
      />,
    );
    const input = screen.getByRole('textbox', { name: /rename session/i });
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(onRenameCommit).toHaveBeenCalledWith(null);
  });

  it('is keyboard-focusable and fires onSelect on Enter / Space', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionItem
        session={baseSession}
        active={false}
        renaming={false}
        onSelect={onSelect}
        onRenameCommit={() => {}}
      />,
    );
    const row = screen.getByTestId('session-item-s1');
    expect(row).toHaveAttribute('tabindex', '0');
    row.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('ignores Enter / Space while in rename mode', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionItem
        session={baseSession}
        active={false}
        renaming
        onSelect={onSelect}
        onRenameCommit={() => {}}
      />,
    );
    const row = screen.getByTestId('session-item-s1');
    row.focus();
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onOpenMenu without firing onSelect when the kebab is clicked', async () => {
    const onSelect = vi.fn();
    const onOpenMenu = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionItem
        session={baseSession}
        active={false}
        renaming={false}
        onSelect={onSelect}
        onRenameCommit={() => {}}
        onOpenMenu={onOpenMenu}
      />,
    );
    await user.click(screen.getByRole('button', { name: /session options/i }));
    expect(onOpenMenu).toHaveBeenCalledWith('s1', expect.any(HTMLElement));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
