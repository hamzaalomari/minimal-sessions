import { spawn as ptySpawn, type IPty } from 'node-pty';
import { EventEmitter } from 'node:events';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { platform } from 'node:process';
import type { SessionId } from '@shared/types';

const isWin = platform === 'win32';

interface PtyEntry {
  pty: IPty;
  cwd: string;
}

const ptys = new Map<SessionId, PtyEntry>();
const bus = new EventEmitter();

function defaultShell(): string {
  if (isWin) {
    return process.env['ComSpec'] ?? 'cmd.exe';
  }
  return process.env['SHELL'] ?? '/bin/zsh';
}

function defaultArgs(): string[] {
  // Use a login shell on Unix so the user's PATH (homebrew, asdf, nvm, etc.) is
  // available — same expectation as opening Terminal.app.
  return isWin ? [] : ['-l'];
}

export interface OpenTerminalOptions {
  sessionId: SessionId;
  cwd: string;
  cols?: number;
  rows?: number;
}

function resolveCwd(raw: string): string {
  const home = homedir();
  // `~` and `~/foo` are user-typed conveniences; posix_spawnp won't expand them.
  let cwd = raw;
  if (cwd === '~') cwd = home;
  else if (cwd.startsWith('~/')) cwd = `${home}${cwd.slice(1)}`;
  try {
    if (statSync(cwd).isDirectory()) return cwd;
  } catch {
    /* fall through */
  }
  // Fall back to $HOME so the shell at least starts somewhere valid.
  return home;
}

export function openTerminal({
  sessionId,
  cwd,
  cols = 80,
  rows = 24,
}: OpenTerminalOptions): { reused: boolean } {
  const existing = ptys.get(sessionId);
  if (existing) {
    // Reuse a still-attached pty across renderer remounts — preserves history.
    return { reused: true };
  }
  const env = { ...process.env, TERM: 'xterm-256color' } as Record<string, string>;
  const resolved = resolveCwd(cwd);
  const pty = ptySpawn(defaultShell(), defaultArgs(), {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: resolved,
    env,
  });
  ptys.set(sessionId, { pty, cwd: resolved });
  pty.onData((data) => {
    bus.emit('data', sessionId, data);
  });
  pty.onExit(({ exitCode }) => {
    ptys.delete(sessionId);
    bus.emit('exit', sessionId, exitCode);
  });
  return { reused: false };
}

export function writeTerminal(sessionId: SessionId, data: string): void {
  ptys.get(sessionId)?.pty.write(data);
}

export function resizeTerminal(
  sessionId: SessionId,
  cols: number,
  rows: number,
): void {
  if (cols < 1 || rows < 1) return;
  const entry = ptys.get(sessionId);
  if (!entry) return;
  try {
    entry.pty.resize(cols, rows);
  } catch {
    // node-pty throws if the descriptor is already gone — harmless.
  }
}

export function closeTerminal(sessionId: SessionId): void {
  const entry = ptys.get(sessionId);
  if (!entry) return;
  ptys.delete(sessionId);
  try {
    entry.pty.kill();
  } catch {
    /* already dead */
  }
}

export function disposeAllTerminals(): void {
  for (const id of [...ptys.keys()]) closeTerminal(id);
}

export function onTerminalData(
  fn: (sessionId: SessionId, data: string) => void,
): () => void {
  bus.on('data', fn);
  return () => bus.off('data', fn);
}

export function onTerminalExit(
  fn: (sessionId: SessionId, code: number) => void,
): () => void {
  bus.on('exit', fn);
  return () => bus.off('exit', fn);
}
