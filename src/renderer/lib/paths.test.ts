import { describe, expect, it } from 'vitest';
import { basename, displayPath } from './paths';

describe('displayPath', () => {
  it('collapses the home prefix to ~', () => {
    expect(displayPath('/Users/h/dev/x', '/Users/h')).toBe('~/dev/x');
  });

  it('returns ~ when path equals home', () => {
    expect(displayPath('/Users/h', '/Users/h')).toBe('~');
  });

  it('handles a trailing-slash home directory', () => {
    expect(displayPath('/Users/h/dev/x', '/Users/h/')).toBe('~/dev/x');
  });

  it('leaves paths outside home untouched', () => {
    expect(displayPath('/etc/hosts', '/Users/h')).toBe('/etc/hosts');
  });

  it('does not collapse when only the prefix is a substring (not separator-aligned)', () => {
    expect(displayPath('/Users/honest/x', '/Users/h')).toBe('/Users/honest/x');
  });

  it('returns the path untouched when home is empty', () => {
    expect(displayPath('/x/y', '')).toBe('/x/y');
  });

  it('passes empty path through', () => {
    expect(displayPath('', '/home/x')).toBe('');
  });
});

describe('basename', () => {
  it('returns the last POSIX segment', () => {
    expect(basename('/a/b/c')).toBe('c');
  });

  it('strips a trailing slash', () => {
    expect(basename('/a/b/')).toBe('b');
  });

  it('handles a path with no separators', () => {
    expect(basename('foo')).toBe('foo');
  });

  it('handles backslash separators', () => {
    expect(basename('C:\\Users\\h\\dev')).toBe('dev');
  });

  it('returns empty for an empty path', () => {
    expect(basename('')).toBe('');
  });
});
