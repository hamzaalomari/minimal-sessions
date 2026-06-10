import { promises as fs } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * Read the current branch name for a working directory.
 *
 * Returns `''` for non-git folders or anything we can't parse — the renderer
 * uses the value as-is in the SessionHead chip, so an empty string just means
 * "no chip".
 *
 * Two cases the file can be in:
 *   - `ref: refs/heads/<name>` for an attached HEAD
 *   - a raw 40-char SHA for a detached HEAD — we return the short SHA so the
 *     user can still tell something is checked out.
 */
export async function branchFor(path: string): Promise<string> {
  if (!path) return '';
  try {
    const head = await fs.readFile(join(path, '.git', 'HEAD'), 'utf8');
    const trimmed = head.trim();
    const refMatch = trimmed.match(/^ref:\s+refs\/heads\/(.+)$/);
    if (refMatch) return refMatch[1]!;
    if (/^[0-9a-f]{40}$/i.test(trimmed)) return trimmed.slice(0, 7);
    return '';
  } catch {
    return '';
  }
}

/** True if `path` exists and is a readable directory. */
export async function dirExists(path: string): Promise<boolean> {
  if (!path) return false;
  try {
    const stat = await fs.stat(path);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Expand a leading `~` to the user's home directory.
 *
 * Anything that isn't `~` or `~/...` is returned untouched — callers may pass
 * already-absolute paths (the native picker always does).
 */
export function expandTilde(path: string, home: string): string {
  if (!path) return path;
  if (path === '~') return home;
  if (path.startsWith('~/') || path.startsWith('~' + sep)) {
    return join(home, path.slice(2));
  }
  return path;
}
