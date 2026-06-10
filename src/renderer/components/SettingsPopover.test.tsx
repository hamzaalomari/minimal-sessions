import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPopover } from './SettingsPopover';

const baseProps = {
  anchor: { left: 10, top: 10 },
  theme: 'light' as const,
  density: 'cozy' as const,
  onThemeChange: vi.fn(),
  onDensityChange: vi.fn(),
  onClose: vi.fn(),
};

describe('<SettingsPopover>', () => {
  it('renders theme and density segment groups', () => {
    render(<SettingsPopover {...baseProps} />);
    expect(screen.getByRole('radiogroup', { name: /theme/i })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /density/i })).toBeInTheDocument();
  });

  it('marks the active theme button as checked', () => {
    render(<SettingsPopover {...baseProps} theme="dark" />);
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the active density button as checked', () => {
    render(<SettingsPopover {...baseProps} density="compact" />);
    expect(screen.getByRole('radio', { name: 'Compact' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Cozy' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onThemeChange when a theme button is clicked', async () => {
    const onThemeChange = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPopover {...baseProps} onThemeChange={onThemeChange} />);
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });

  it('calls onDensityChange when a density button is clicked', async () => {
    const onDensityChange = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPopover {...baseProps} onDensityChange={onDensityChange} />);
    await user.click(screen.getByRole('radio', { name: 'Compact' }));
    expect(onDensityChange).toHaveBeenCalledWith('compact');
  });

  it('closes on outside mousedown', () => {
    const onClose = vi.fn();
    render(
      <div>
        <SettingsPopover {...baseProps} onClose={onClose} />
        <span data-testid="outside">outside</span>
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
