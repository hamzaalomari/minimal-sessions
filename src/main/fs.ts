import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

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
    // In a normal repo `.git` is a directory containing HEAD. In a *worktree*
    // `.git` is a file with a line like `gitdir: /abs/path/to/.git/worktrees/<name>`,
    // and HEAD lives inside that gitdir. Resolve both shapes.
    let headPath = join(path, '.git', 'HEAD');
    try {
      const dotGit = await fs.stat(join(path, '.git'));
      if (dotGit.isFile()) {
        const raw = await fs.readFile(join(path, '.git'), 'utf8');
        const m = raw.match(/^gitdir:\s*(.+?)\s*$/m);
        if (m) {
          const gitdir = m[1]!;
          headPath = join(gitdir, 'HEAD');
        }
      }
    } catch {
      // `.git` doesn't exist at all — branchFor below will throw and we
      // return ''.
    }
    const head = await fs.readFile(headPath, 'utf8');
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

/** Inputs to gitInitSession — mirrors the IPC contract. */
export interface GitInitSessionInput {
  path: string;
  mode: 'none' | 'branch' | 'worktree';
  /** Branch / worktree name. Required when mode !== 'none'. */
  name?: string;
}

/** Result handed back to the renderer — the resolved path + branch the new
 *  session should open against. */
export interface GitInitSessionResult {
  path: string;
  branch: string;
}

/** Git refs forbid spaces, `~`, `^`, `:`, `\`, `?`, `*`, `[`, and a few more.
 *  We do a permissive check here — git itself is the source of truth on the
 *  actual operation, but we want to catch obvious mistakes before spawning. */
function isValidRefName(name: string): boolean {
  if (!name) return false;
  if (name.length > 200) return false;
  // Forbid the standard set + leading dot/slash + double dots.
  if (/[\s~^:?*[\\]/.test(name)) return false;
  if (/^[./]|\.\.|@{|\.lock$/.test(name)) return false;
  return true;
}

/**
 * Run the git side-effect the user picked in the New Session panel, and
 * return the path + branch the session should actually open against.
 *
 *   - `mode: 'none'`     → leaves the working tree alone; returns input path.
 *   - `mode: 'branch'`   → `git -C <path> switch -c <name>` in place.
 *   - `mode: 'worktree'` → `git -C <path> worktree add <newPath> -b <name>`,
 *                          where newPath is `<path>-<name>` (sibling dir).
 *
 * Throws with a human-readable message on any failure (path isn't a repo,
 * branch name taken, target dir exists, etc.). The renderer surfaces that
 * message inline in the New Session panel.
 */
export async function gitInitSession({
  path,
  mode,
  name,
}: GitInitSessionInput): Promise<GitInitSessionResult> {
  if (!path) throw new Error('No path provided');
  if (!(await dirExists(path))) throw new Error(`Cannot read ${path}`);

  if (mode === 'none') {
    return { path, branch: await branchFor(path) };
  }

  if (!name || !isValidRefName(name)) {
    throw new Error(
      'Invalid branch name. Use letters, numbers, and dash/underscore/slash only.',
    );
  }

  // Confirm it's a git repo before any side-effects.
  try {
    await execFileP('git', ['-C', path, 'rev-parse', '--git-dir']);
  } catch {
    throw new Error(`${path} is not a git repository`);
  }

  if (mode === 'branch') {
    try {
      await execFileP('git', ['-C', path, 'switch', '-c', name]);
    } catch (e) {
      const stderr = (e as { stderr?: string }).stderr?.trim() ?? '';
      throw new Error(stderr || `Could not create branch ${name}`);
    }
    return { path, branch: name };
  }

  // mode === 'worktree'. Place the new worktree as a sibling so it's
  // predictable and easy to find in Finder / file managers.
  const target = `${path}-${name}`;
  if (await dirExists(target)) {
    throw new Error(`Target folder already exists: ${target}`);
  }
  try {
    await execFileP('git', [
      '-C',
      path,
      'worktree',
      'add',
      target,
      '-b',
      name,
    ]);
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr?.trim() ?? '';
    throw new Error(stderr || `Could not create worktree ${name}`);
  }
  return { path: target, branch: name };
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
