/**
 * Main-process file logger.
 *
 * Writes line-delimited diagnostic events to
 *   ~/Library/Logs/Minimal Sessions/main.log   (macOS)
 *   ~/.config/Minimal Sessions/logs/main.log   (Linux)
 *   %APPDATA%\Minimal Sessions\logs\main.log   (Windows)
 *
 * Also mirrors to stderr so a terminal-launched build sees the same output.
 *
 * The point is observability for "why did chat:send do nothing" — packaged
 * Electron apps swallow main-process console output when launched from
 * Finder, so without a file we have no telemetry at all when a user reports
 * a silent failure on someone else's machine.
 *
 * The logger never throws. We open the file lazily, swallow ENOSPC / EACCES
 * on write, and keep going — failing to log must not break the app.
 */

import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const requireFromHere = createRequire(import.meta.url);

let stream: WriteStream | null = null;
let streamPath = '';

// Lazy because some tests transitively import this module (via chat.ts) but
// run with `npm ci --ignore-scripts`, which skips electron's postinstall and
// leaves require('electron') throwing. Loading it inside ensureStream lets
// the test environment fall back to stderr-only without crashing.
function getLogsDir(): string | null {
  try {
    const electron = requireFromHere('electron') as typeof import('electron');
    return electron.app.getPath('logs');
  } catch {
    return null;
  }
}

function ensureStream(): { stream: WriteStream; path: string } | null {
  if (stream && streamPath) return { stream, path: streamPath };
  try {
    const dir = getLogsDir();
    if (!dir) return null;
    mkdirSync(dir, { recursive: true });
    streamPath = join(dir, 'main.log');
    stream = createWriteStream(streamPath, { flags: 'a' });
    return { stream, path: streamPath };
  } catch {
    return null;
  }
}

export function logPath(): string {
  return ensureStream()?.path ?? '';
}

export function log(tag: string, msg: string, extra?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const extras = extra && Object.keys(extra).length > 0 ? ' ' + safeJson(extra) : '';
  const line = `${ts} [${tag}] ${msg}${extras}\n`;
  try {
    process.stderr.write(line);
  } catch {
    /* ignore */
  }
  const got = ensureStream();
  if (!got) return;
  try {
    got.stream.write(line);
  } catch {
    /* swallow — never crash on logging */
  }
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '<unserializable>';
  }
}
