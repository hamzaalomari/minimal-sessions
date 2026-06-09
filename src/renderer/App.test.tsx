import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api, Platform } from '@shared/api';
import { App } from './App';
import { useTweaks } from './state/tweaks';

function installApi(platform: Platform = 'darwin'): Api {
  const api: Api = {
    app: {
      ping: vi.fn().mockResolvedValue('pong' as const),
      platform: vi.fn().mockResolvedValue(platform),
    },
  };
  (window as unknown as { api: Api }).api = api;
  return api;
}

describe('<App />', () => {
  beforeEach(() => {
    localStorage.clear();
    useTweaks.setState({
      theme: 'light',
      accent: '#c4663f',
      readFont: 'sans',
      density: 'cozy',
    });
  });

  afterEach(() => {
    delete (window as unknown as { api?: Api }).api;
  });

  it('renders the title bar and activity bar shell', async () => {
    installApi('darwin');
    render(<App />);

    expect(screen.getByText('Claude Session Viewer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle sessions sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();

    // Drain the async IPC effect so React isn't still updating after the test exits.
    await screen.findByText('pong');
  });

  it('calls window.api.ping and renders the pong result', async () => {
    const api = installApi('darwin');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('pong')).toBeInTheDocument();
    });
    expect(api.app.ping).toHaveBeenCalledTimes(1);
    expect(api.app.platform).toHaveBeenCalledTimes(1);
  });

  it('renders traffic light dots on macOS', async () => {
    installApi('darwin');
    const { container } = render(<App />);
    await waitFor(() => {
      expect(container.querySelector('.traffic')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.tdot')).toHaveLength(3);
  });

  it('hides traffic light dots on non-mac platforms', async () => {
    installApi('win32');
    const { container } = render(<App />);
    await waitFor(() => {
      expect(screen.getByText('win32')).toBeInTheDocument();
    });
    expect(container.querySelector('.traffic')).not.toBeInTheDocument();
  });

  it('theme toggle flips light ↔ dark and updates the label', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    render(<App />);

    const btn = screen.getByRole('button', { name: /toggle theme/i });
    expect(btn).toHaveTextContent(/dark/i);

    await user.click(btn);
    expect(useTweaks.getState().theme).toBe('dark');
    expect(btn).toHaveTextContent(/light/i);

    await user.click(btn);
    expect(useTweaks.getState().theme).toBe('light');
  });

  it('sidebar toggle collapses the side panel', async () => {
    installApi('darwin');
    const user = userEvent.setup();
    const { container } = render(<App />);

    const root = container.querySelector('.app');
    expect(root).not.toHaveClass('side-collapsed');

    await user.click(screen.getByRole('button', { name: /toggle sessions sidebar/i }));
    expect(root).toHaveClass('side-collapsed');
  });
});
