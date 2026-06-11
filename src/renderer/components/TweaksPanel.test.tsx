import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTweaks } from '../state/tweaks';
import { TweaksPanel } from './TweaksPanel';

function resetTweaks() {
  useTweaks.setState({
    theme: 'light',
    accent: '#c4663f',
    readFont: 'sans',
    density: 'cozy',
    systemPrompt: '',
  });
}

describe('<TweaksPanel />', () => {
  beforeEach(() => {
    localStorage.clear();
    resetTweaks();
  });

  it('reflects current tweaks state in its controls', () => {
    useTweaks.setState({
      theme: 'dark',
      readFont: 'serif',
      systemPrompt: 'be concise',
    });
    render(<TweaksPanel onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: /^dark$/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /^serif$/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('tweaks-system-prompt')).toHaveValue('be concise');
  });

  it('updates theme in the store when clicked', async () => {
    const user = userEvent.setup();
    render(<TweaksPanel onClose={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /^dark$/i }));
    expect(useTweaks.getState().theme).toBe('dark');
  });

  it('updates the reading font in the store when clicked', async () => {
    const user = userEvent.setup();
    render(<TweaksPanel onClose={() => {}} />);
    await user.click(screen.getByRole('radio', { name: /^serif$/i }));
    expect(useTweaks.getState().readFont).toBe('serif');
    await user.click(screen.getByRole('radio', { name: /^mono$/i }));
    expect(useTweaks.getState().readFont).toBe('mono');
  });

  it('renders a live preview line that picks up the current --read variable', () => {
    render(<TweaksPanel onClose={() => {}} />);
    expect(screen.getByTestId('tweaks-preview')).toBeInTheDocument();
  });

  it('writes the system prompt to the store as the user types', async () => {
    const user = userEvent.setup();
    render(<TweaksPanel onClose={() => {}} />);
    await user.type(screen.getByTestId('tweaks-system-prompt'), 'no preamble');
    expect(useTweaks.getState().systemPrompt).toBe('no preamble');
  });

  it('fires onClose from the Done button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<TweaksPanel onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /^done$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
