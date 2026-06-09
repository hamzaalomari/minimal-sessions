/**
 * Typed IPC surface exposed on `window.api`.
 *
 * Implemented progressively across the milestones — only the M0 stub is wired
 * for now. Each method maps to an `ipcMain.handle()` in the main process.
 */

export type ModelFamily = 'opus' | 'sonnet' | 'haiku';
/** A specific model ID the API exposes, e.g. 'claude-sonnet-4-6'. */
export type ModelId = string;

/** Subset of `NodeJS.Platform` re-declared in plain TS so the renderer doesn't need @types/node. */
export type Platform = 'darwin' | 'win32' | 'linux' | 'freebsd' | 'openbsd' | 'sunos' | 'aix';

export interface Api {
  app: {
    /** Smoke test — returns 'pong' from main. Used to verify the IPC wiring. */
    ping(): Promise<'pong'>;
    /** Host platform — the renderer uses this to draw traffic lights vs. min/max/close. */
    platform(): Promise<Platform>;
  };
}

declare global {
  interface Window {
    api: Api;
  }
}
