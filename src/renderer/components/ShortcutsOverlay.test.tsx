import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import { setPlatform } from '../lib/platform';

describe('<ShortcutsOverlay />', () => {
  afterEach(() => {
    // Reset cached platform so other tests don't see mac state.
    setPlatform('darwin');
  });

  it('lists the four groups of shortcuts', () => {
    setPlatform('darwin');
    render(<ShortcutsOverlay onClose={() => {}} />);
    expect(screen.getByText('Sessions & tabs')).toBeInTheDocument();
    expect(screen.getByText('View & navigation')).toBeInTheDocument();
    expect(screen.getByText('Composer')).toBeInTheDocument();
  });

  it('renders mac glyphs on darwin', () => {
    setPlatform('darwin');
    render(<ShortcutsOverlay onClose={() => {}} />);
    // ⌘N for new session.
    expect(screen.getByText('⌘N')).toBeInTheDocument();
  });

  it('rewrites mac glyphs to Ctrl+/Shift+ on non-mac', () => {
    setPlatform('win32');
    render(<ShortcutsOverlay onClose={() => {}} />);
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument();
    expect(screen.queryByText('⌘N')).toBeNull();
  });

  it('closes on Escape', async () => {
    setPlatform('darwin');
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsOverlay onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the close button is clicked', async () => {
    setPlatform('darwin');
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsOverlay onClose={onClose} />);
    await user.click(screen.getByLabelText(/Close shortcuts/));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the scrim is clicked but not the panel', async () => {
    setPlatform('darwin');
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShortcutsOverlay onClose={onClose} />);
    // Click inside the dialog — should NOT close.
    await user.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    // Click the scrim — should close.
    await user.click(screen.getByTestId('shortcuts-overlay'));
    expect(onClose).toHaveBeenCalled();
  });
});
