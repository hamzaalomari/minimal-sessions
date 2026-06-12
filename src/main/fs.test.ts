import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { branchFor, dirExists, expandTilde, gitInitSession } from './fs';

const execFileP = promisify(execFile);

/** Initialise a real git repo with a single commit at `dir`. The git CLI is
 *  available on every dev machine and on CI, and using it here keeps the
 *  test honest — we exercise the same code paths git would in production. */
async function initRepo(dir: string): Promise<void> {
  await execFileP('git', ['init', '-q', '-b', 'main', dir]);
  await execFileP('git', ['-C', dir, 'config', 'user.email', 't@t']);
  await execFileP('git', ['-C', dir, 'config', 'user.name', 'T']);
  await execFileP('git', ['-C', dir, 'config', 'commit.gpgsign', 'false']);
  await fs.writeFile(join(dir, 'README.md'), 'hi\n');
  await execFileP('git', ['-C', dir, 'add', '.']);
  await execFileP('git', ['-C', dir, 'commit', '-q', '-m', 'init']);
}

describe('branchFor', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'csv-fs-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the branch name from a normal ref HEAD', async () => {
    await fs.mkdir(join(dir, '.git'), { recursive: true });
    await fs.writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    expect(await branchFor(dir)).toBe('main');
  });

  it('preserves slashes in branch names like feature/foo', async () => {
    await fs.mkdir(join(dir, '.git'), { recursive: true });
    await fs.writeFile(join(dir, '.git', 'HEAD'), 'ref: refs/heads/feature/foo\n');
    expect(await branchFor(dir)).toBe('feature/foo');
  });

  it('returns a short SHA for detached HEAD', async () => {
    await fs.mkdir(join(dir, '.git'), { recursive: true });
    await fs.writeFile(
      join(dir, '.git', 'HEAD'),
      '1234567890abcdef1234567890abcdef12345678\n',
    );
    expect(await branchFor(dir)).toBe('1234567');
  });

  it('returns empty string when there is no .git folder', async () => {
    expect(await branchFor(dir)).toBe('');
  });

  it('returns empty string when path is empty', async () => {
    expect(await branchFor('')).toBe('');
  });

  it('returns empty string for unparseable HEAD content', async () => {
    await fs.mkdir(join(dir, '.git'), { recursive: true });
    await fs.writeFile(join(dir, '.git', 'HEAD'), 'whatever-this-is\n');
    expect(await branchFor(dir)).toBe('');
  });
});

describe('dirExists', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'csv-fs-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns true for an existing directory', async () => {
    expect(await dirExists(dir)).toBe(true);
  });

  it('returns false for a path that does not exist', async () => {
    expect(await dirExists(join(dir, 'nope'))).toBe(false);
  });

  it('returns false for a file (not a directory)', async () => {
    const file = join(dir, 'a.txt');
    await fs.writeFile(file, 'hi');
    expect(await dirExists(file)).toBe(false);
  });

  it('returns false for an empty path', async () => {
    expect(await dirExists('')).toBe(false);
  });
});

describe('gitInitSession', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ms-git-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    // Worktrees land alongside the repo as `<dir>-<name>`.
    await rm(`${dir}-feature`, { recursive: true, force: true });
  });

  it('mode: none returns the input path and current branch', async () => {
    await initRepo(dir);
    const result = await gitInitSession({ path: dir, mode: 'none' });
    expect(result).toEqual({ path: dir, branch: 'main' });
  });

  it('mode: branch creates the branch and reports it as current', async () => {
    await initRepo(dir);
    const result = await gitInitSession({
      path: dir,
      mode: 'branch',
      name: 'feature/x',
    });
    expect(result.path).toBe(dir);
    expect(result.branch).toBe('feature/x');
    expect(await branchFor(dir)).toBe('feature/x');
  });

  it('mode: worktree creates a sibling dir on a new branch', async () => {
    await initRepo(dir);
    const result = await gitInitSession({
      path: dir,
      mode: 'worktree',
      name: 'feature',
    });
    expect(result.path).toBe(`${dir}-feature`);
    expect(result.branch).toBe('feature');
    expect(await dirExists(`${dir}-feature`)).toBe(true);
    expect(await branchFor(`${dir}-feature`)).toBe('feature');
  });

  it('rejects invalid ref names without spawning git', async () => {
    await initRepo(dir);
    await expect(
      gitInitSession({ path: dir, mode: 'branch', name: 'has spaces' }),
    ).rejects.toThrow(/invalid/i);
  });

  it('fails clearly when the path is not a git repo', async () => {
    await expect(
      gitInitSession({ path: dir, mode: 'branch', name: 'feature' }),
    ).rejects.toThrow(/not a git repository/i);
  });

  it('fails when the worktree target already exists', async () => {
    await initRepo(dir);
    await fs.mkdir(`${dir}-feature`, { recursive: true });
    await expect(
      gitInitSession({ path: dir, mode: 'worktree', name: 'feature' }),
    ).rejects.toThrow(/already exists/i);
  });
});

describe('expandTilde', () => {
  it('expands a bare ~ to the home directory', () => {
    expect(expandTilde('~', '/home/x')).toBe('/home/x');
  });

  it('expands ~/foo to home/foo', () => {
    expect(expandTilde('~/foo', '/home/x')).toBe('/home/x/foo');
  });

  it('leaves absolute paths untouched', () => {
    expect(expandTilde('/etc/hosts', '/home/x')).toBe('/etc/hosts');
  });

  it('leaves the empty string untouched', () => {
    expect(expandTilde('', '/home/x')).toBe('');
  });

  it('does not expand a leading ~name (unrelated user)', () => {
    expect(expandTilde('~root/cfg', '/home/x')).toBe('~root/cfg');
  });
});
