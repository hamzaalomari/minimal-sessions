import { promises as fs } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { branchFor, dirExists, expandTilde } from './fs';

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
