import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Api, UpdaterState } from '@shared/api';
import { SettingsPopover } from './SettingsPopover';

/** Install a minimal `window.api` so the SettingsPopover's Updates section
 *  has something to read. Returns the check spy so individual tests can
 *  assert on it. */
function installApiForUpdates(version: string, updater: UpdaterState): { check: ReturnType<typeof vi.fn> } {
  const check = vi.fn().mockResolvedValue(undefined);
  const api: Pick<Api, 'app' | 'updater'> = {
    app: {
      ping: vi.fn().mockResolvedValue('pong' as const),
      platform: vi.fn().mockResolvedValue('darwin'),
      closeWindow: vi.fn().mockResolvedValue(undefined),
      homeDir: vi.fn().mockResolvedValue('/Users/h'),
      version: vi.fn().mockResolvedValue(version),
      openExternal: vi.fn().mockResolvedValue(undefined),
      onRequestCloseTab: vi.fn(() => () => {}),
      onRequestNewSession: vi.fn(() => () => {}),
      onRequestToggleSidebar: vi.fn(() => () => {}),
      onRequestOpenSettings: vi.fn(() => () => {}),
      onRequestOpenSearch: vi.fn(() => () => {}),
      onRequestToggleTerminal: vi.fn(() => () => {}),
      onRequestToggleShortcuts: vi.fn(() => () => {}),
      onRequestSelectTab: vi.fn(() => () => {}),
      onRequestNavigateBack: vi.fn(() => () => {}),
      onRequestNavigateForward: vi.fn(() => () => {}),
      onRequestNextTab: vi.fn(() => () => {}),
      onRequestPrevTab: vi.fn(() => () => {}),
    },
    updater: {
      getState: vi.fn().mockResolvedValue(updater),
      check,
      install: vi.fn().mockResolvedValue(undefined),
      onState: vi.fn(() => () => {}),
    },
  };
  (window as unknown as { api: Pick<Api, 'app' | 'updater'> }).api = api;
  return { check };
}

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

  it('fires onOpenTweaks when the "More controls in Tweaks" row is clicked', async () => {
    const onOpenTweaks = vi.fn();
    const user = userEvent.setup();
    render(<SettingsPopover {...baseProps} onOpenTweaks={onOpenTweaks} />);
    await user.click(screen.getByTestId('open-tweaks'));
    expect(onOpenTweaks).toHaveBeenCalledTimes(1);
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

  it('does NOT close on mousedown inside the trigger element (toggle support)', () => {
    const onClose = vi.fn();
    // Render the trigger first so we can pass its DOM node.
    const { container } = render(<button data-testid="trigger">Settings</button>);
    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLElement;
    render(<SettingsPopover {...baseProps} onClose={onClose} triggerEl={trigger} />);
    fireEvent.mouseDown(trigger);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('<SettingsPopover> Updates section', () => {
  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it('renders the current app version', async () => {
    installApiForUpdates('1.2.3', { status: 'idle', enabled: true });
    render(<SettingsPopover {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Minimal Sessions v1.2.3/)).toBeInTheDocument();
    });
  });

  it('disables the Check-for-updates button when the updater is off', async () => {
    installApiForUpdates('1.0.0', { status: 'idle', enabled: false });
    render(<SettingsPopover {...baseProps} />);
    await waitFor(() => {
      const btn = screen.getByTestId('check-for-updates');
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent(/Auto-update disabled/);
    });
  });

  it('fires window.api.updater.check() when the user clicks Check for updates', async () => {
    const user = userEvent.setup();
    const { check } = installApiForUpdates('1.0.0', { status: 'idle', enabled: true });
    render(<SettingsPopover {...baseProps} />);
    const btn = await screen.findByTestId('check-for-updates');
    await user.click(btn);
    expect(check).toHaveBeenCalled();
  });

  it('summarizes a ready-to-install update', async () => {
    installApiForUpdates('1.0.0', {
      status: 'ready',
      enabled: true,
      version: '1.1.0',
    });
    render(<SettingsPopover {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('check-for-updates')).toHaveTextContent(
        /v1.1.0 ready — restart to install/,
      );
    });
  });
});
