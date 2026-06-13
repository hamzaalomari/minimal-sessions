import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api, UpdaterState } from '@shared/api';
import { UpdateBanner } from './UpdateBanner';

/** Flush both microtasks (so getState().then runs) and React effect commits
 *  before pushing a new state from `emit()`. Without this the synchronous
 *  emit lands first, then the slower getState resolution overwrites it. */
async function flushInitialHydration(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

interface UpdaterMock {
  api: Pick<Api, 'updater'>;
  emit: (state: UpdaterState) => void;
}

function installUpdaterApi(initial: UpdaterState): UpdaterMock {
  let handler: ((state: UpdaterState) => void) | null = null;
  const api: Pick<Api, 'updater'> = {
    updater: {
      getState: vi.fn().mockResolvedValue(initial),
      check: vi.fn().mockResolvedValue(undefined),
      install: vi.fn().mockResolvedValue(undefined),
      onState: vi.fn((h) => {
        handler = h;
        return () => {
          handler = null;
        };
      }),
    },
  };
  (window as unknown as { api: Pick<Api, 'updater'> }).api = api;
  return {
    api,
    emit: (state) => handler?.(state),
  };
}

describe('<UpdateBanner />', () => {
  beforeEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it('renders nothing when the updater is disabled', async () => {
    installUpdaterApi({ status: 'idle', enabled: false });
    const { container } = render(<UpdateBanner />);
    await waitFor(() => {
      expect(container.querySelector('.update-banner')).toBeNull();
    });
  });

  it('stays silent in idle / not-available even when enabled', async () => {
    installUpdaterApi({ status: 'idle', enabled: true });
    const { container } = render(<UpdateBanner />);
    await waitFor(() => {
      expect(container.querySelector('.update-banner')).toBeNull();
    });
  });

  it('surfaces an available update with the version', async () => {
    const { emit } = installUpdaterApi({ status: 'idle', enabled: true });
    render(<UpdateBanner />);
    await flushInitialHydration();
    act(() => emit({ status: 'available', enabled: true, version: '1.2.3' }));
    await waitFor(() => {
      expect(screen.getByText(/Update v1.2.3 available/i)).toBeInTheDocument();
    });
  });

  it('shows the restart CTA when an update is downloaded and triggers install', async () => {
    const user = userEvent.setup();
    const { emit, api } = installUpdaterApi({ status: 'idle', enabled: true });
    render(<UpdateBanner />);
    await flushInitialHydration();
    act(() => emit({ status: 'ready', enabled: true, version: '1.2.3' }));
    const cta = await screen.findByRole('button', { name: /Restart/ });
    await user.click(cta);
    expect(api.updater.install).toHaveBeenCalled();
  });

  it('can be dismissed and stays dismissed until the next state change', async () => {
    const user = userEvent.setup();
    const { emit } = installUpdaterApi({ status: 'idle', enabled: true });
    render(<UpdateBanner />);
    await flushInitialHydration();
    act(() => emit({ status: 'available', enabled: true, version: '1.0.0' }));
    await screen.findByText(/Update v1.0.0 available/i);
    await user.click(screen.getByLabelText(/Dismiss update notice/i));
    expect(screen.queryByText(/Update v1.0.0/)).toBeNull();
    // A new state pushed by main rearms the banner.
    act(() => emit({ status: 'ready', enabled: true, version: '1.0.0' }));
    await screen.findByText(/Update v1.0.0 ready/i);
  });

  it('surfaces an error with a Retry CTA', async () => {
    const user = userEvent.setup();
    const { emit, api } = installUpdaterApi({ status: 'idle', enabled: true });
    render(<UpdateBanner />);
    await flushInitialHydration();
    act(() => emit({ status: 'error', enabled: true, error: 'network down' }));
    await screen.findByText(/Update failed: network down/);
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(api.updater.check).toHaveBeenCalled();
  });
});
