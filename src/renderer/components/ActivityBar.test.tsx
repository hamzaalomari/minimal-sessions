import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityBar } from './ActivityBar';

const noop = () => {};

const base = {
  sideOpen: true,
  sidebarView: 'sessions' as const,
  onToggleSide: noop,
  onSelectSessions: noop,
  onSelectHistory: noop,
  onSelectAnalytics: noop,
  onSelectPlugins: noop,
};

describe('<ActivityBar />', () => {
  it('marks the Sessions button "on" when sessions view is open', () => {
    render(<ActivityBar {...base} />);
    const btn = screen.getByRole('button', { name: /toggle sessions sidebar/i });
    expect(btn).toHaveClass('on');
  });

  it('does not mark Sessions "on" when history view is open', () => {
    render(<ActivityBar {...base} sidebarView="history" />);
    expect(
      screen.getByRole('button', { name: /toggle sessions sidebar/i }),
    ).not.toHaveClass('on');
    expect(
      screen.getByRole('button', { name: /deleted sessions history/i }),
    ).toHaveClass('on');
  });

  it('clicking Sessions on an open sessions view collapses the side', async () => {
    const onToggleSide = vi.fn();
    const user = userEvent.setup();
    render(<ActivityBar {...base} onToggleSide={onToggleSide} />);
    await user.click(screen.getByRole('button', { name: /toggle sessions sidebar/i }));
    expect(onToggleSide).toHaveBeenCalledTimes(1);
  });

  it('clicking History switches the view and opens the side if collapsed', async () => {
    const onToggleSide = vi.fn();
    const onSelectHistory = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityBar
        {...base}
        sideOpen={false}
        onToggleSide={onToggleSide}
        onSelectHistory={onSelectHistory}
      />,
    );
    await user.click(screen.getByRole('button', { name: /deleted sessions history/i }));
    expect(onToggleSide).toHaveBeenCalledTimes(1);
    expect(onSelectHistory).toHaveBeenCalledTimes(1);
  });

  it('fires onOpenSettings + onOpenSearch when their buttons are clicked', async () => {
    const onOpenSettings = vi.fn();
    const onOpenSearch = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityBar
        {...base}
        onOpenSettings={onOpenSettings}
        onOpenSearch={onOpenSearch}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^settings$/i }));
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('marks Search "on" when the search view is open, and a second click collapses', async () => {
    const onToggleSide = vi.fn();
    const onOpenSearch = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityBar
        {...base}
        sidebarView="search"
        onToggleSide={onToggleSide}
        onOpenSearch={onOpenSearch}
      />,
    );
    const btn = screen.getByRole('button', { name: /^search$/i });
    expect(btn).toHaveClass('on');
    await user.click(btn);
    expect(onToggleSide).toHaveBeenCalledTimes(1);
    expect(onOpenSearch).not.toHaveBeenCalled();
  });
});
