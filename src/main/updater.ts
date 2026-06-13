import type { BrowserWindow } from 'electron';
import { app } from 'electron';

/**
 * Auto-updater state we broadcast to the renderer. The banner reads
 * `status` to decide what to render; `version` is shown when a release
 * is available or staged for install; `error` is the surfaced message
 * when something goes wrong (network down, bad signature, etc.).
 */
export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UpdaterState {
  status: UpdaterStatus;
  version?: string;
  /** 0-1 download progress when status === 'downloading'. */
  progress?: number;
  error?: string;
  /** True while the updater is *armed*: packaged build, not disabled by env. */
  enabled: boolean;
}

let currentState: UpdaterState = { status: 'idle', enabled: false };
let getWindowImpl: (() => BrowserWindow | null) | null = null;
// Lazy-imported `electron-updater` autoUpdater — only loaded in packaged builds
// to keep dev startup fast and avoid native-binding noise. Typed loosely since
// we only call a handful of methods and the module's surface is large.
let updaterRef: {
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, listener: (arg?: any) => void): void;
  autoDownload: boolean;
} | null = null;

export function getUpdaterState(): UpdaterState {
  return currentState;
}

function setState(next: Partial<UpdaterState>): void {
  currentState = { ...currentState, ...next };
  const win = getWindowImpl?.();
  win?.webContents.send('updater:state', currentState);
}

/**
 * Wire up electron-updater. Only loads the module + arms it when packaged
 * (electron-updater is a no-op against unpackaged code on disk anyway,
 * but importing it pulls in native bits we don't want in dev).
 *
 * `MS_DISABLE_AUTO_UPDATE=1` lets users opt out without touching settings.
 *
 * Returns immediately; the first background check fires 10s after start
 * so we don't compete with window paint. Subsequent checks run every 6h.
 */
export async function initAutoUpdater(
  getWindow: () => BrowserWindow | null,
): Promise<void> {
  getWindowImpl = getWindow;
  const disabled = process.env['MS_DISABLE_AUTO_UPDATE'] === '1';
  if (!app.isPackaged || disabled) {
    setState({ enabled: false, status: 'idle' });
    return;
  }
  try {
    const mod = await import('electron-updater');
    const updater = mod.autoUpdater as unknown as typeof updaterRef;
    if (!updater) return;
    updaterRef = updater;
    updater.autoDownload = true;

    updater.on('checking-for-update', () => {
      setState({ status: 'checking', error: undefined });
    });
    updater.on('update-available', (info: { version?: string } | undefined) => {
      setState({ status: 'available', version: info?.version, error: undefined });
    });
    updater.on('update-not-available', () => {
      setState({ status: 'not-available', error: undefined });
    });
    updater.on('download-progress', (p: { percent?: number } | undefined) => {
      const pct =
        typeof p?.percent === 'number' ? Math.max(0, Math.min(1, p.percent / 100)) : 0;
      setState({ status: 'downloading', progress: pct, error: undefined });
    });
    updater.on('update-downloaded', (info: { version?: string } | undefined) => {
      setState({
        status: 'ready',
        version: info?.version ?? currentState.version,
        progress: 1,
        error: undefined,
      });
    });
    updater.on('error', (err: Error | string | undefined) => {
      const message = err instanceof Error ? err.message : String(err ?? 'Update error');
      setState({ status: 'error', error: message });
    });

    setState({ enabled: true, status: 'idle' });

    // Kick off the first check a few seconds after startup so it doesn't
    // race with PTY spawning and first-paint. Then every 6h while the
    // app stays open.
    setTimeout(() => void runCheck(), 10_000);
    setInterval(() => void runCheck(), 6 * 60 * 60 * 1000);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'electron-updater failed to load';
    setState({ enabled: false, status: 'error', error: message });
  }
}

export async function checkForUpdatesNow(): Promise<void> {
  await runCheck();
}

async function runCheck(): Promise<void> {
  if (!updaterRef) return;
  try {
    await updaterRef.checkForUpdates();
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Update check failed';
    setState({ status: 'error', error: message });
  }
}

export function quitAndInstallUpdate(): void {
  if (!updaterRef) return;
  updaterRef.quitAndInstall();
}
