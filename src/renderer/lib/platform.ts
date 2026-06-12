/** Renderer-side platform detection. The main process tells us the platform
 * once via `app.platform()`; this module caches it so synchronous helpers like
 * formatShortcut() can stay simple. Until the IPC resolves, we fall back to
 * sniffing the user agent — good enough for the first paint. */

import type { Platform } from '@shared/api';

let cached: Platform | null = null;

function sniff(): Platform {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Mac|iPhone|iPad|iPod/i.test(ua)) return 'darwin';
  if (/Windows/i.test(ua)) return 'win32';
  return 'linux';
}

export function setPlatform(p: Platform): void {
  cached = p;
}

export function getPlatform(): Platform {
  return cached ?? sniff();
}

export function isMac(): boolean {
  return getPlatform() === 'darwin';
}

/**
 * Format a keyboard shortcut for display. Pass the key portion only — the
 * modifier is added per-platform. VSCode conventions:
 *   - macOS: "⌘J", "⇧⌘W", "⌘,"
 *   - Win/Linux: "Ctrl+J", "Ctrl+Shift+W", "Ctrl+,"
 *
 * `shift` adds the shift modifier; pass true for chords like Shift+Cmd+W.
 */
export function formatShortcut(key: string, opts: { shift?: boolean } = {}): string {
  const mac = isMac();
  if (mac) {
    const shift = opts.shift ? '⇧' : '';
    return `${shift}⌘${key.toUpperCase()}`;
  }
  const shift = opts.shift ? 'Shift+' : '';
  return `Ctrl+${shift}${key.toUpperCase()}`;
}
