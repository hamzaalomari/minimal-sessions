import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityBar } from './ActivityBar';

describe('<ActivityBar />', () => {
  it('marks the Sessions button "on" when sideOpen is true', () => {
    render(<ActivityBar sideOpen onToggleSide={() => {}} />);
    const btn = screen.getByRole('button', { name: /toggle sessions sidebar/i });
    expect(btn).toHaveClass('on');
  });

  it('does not mark Sessions "on" when sideOpen is false', () => {
    render(<ActivityBar sideOpen={false} onToggleSide={() => {}} />);
    expect(
      screen.getByRole('button', { name: /toggle sessions sidebar/i }),
    ).not.toHaveClass('on');
  });

  it('fires onToggleSide when the Sessions button is clicked', async () => {
    const onToggleSide = vi.fn();
    const user = userEvent.setup();
    render(<ActivityBar sideOpen onToggleSide={onToggleSide} />);
    await user.click(screen.getByRole('button', { name: /toggle sessions sidebar/i }));
    expect(onToggleSide).toHaveBeenCalledTimes(1);
  });

  it('fires onOpenSettings + onOpenSearch when their buttons are clicked', async () => {
    const onOpenSettings = vi.fn();
    const onOpenSearch = vi.fn();
    const user = userEvent.setup();
    render(
      <ActivityBar
        sideOpen
        onToggleSide={() => {}}
        onOpenSettings={onOpenSettings}
        onOpenSearch={onOpenSearch}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^settings$/i }));
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});
