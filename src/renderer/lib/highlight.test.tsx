import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { highlightNodes } from './highlight';

function html(nodes: ReactNode) {
  return render(<div>{nodes}</div>).container.firstChild as HTMLElement;
}

describe('highlightNodes', () => {
  it('returns plain text unchanged when there is nothing to highlight', () => {
    const el = html(highlightNodes('foo bar baz'));
    expect(el.textContent).toBe('foo bar baz');
    expect(el.querySelectorAll('span')).toHaveLength(0);
  });

  it('highlights JS keywords', () => {
    const el = html(highlightNodes('const x = 1'));
    const key = el.querySelector('.c-key');
    expect(key?.textContent).toBe('const');
    expect(el.textContent).toBe('const x = 1');
  });

  it('highlights double-quoted strings', () => {
    const el = html(highlightNodes('msg = "hi"'));
    const str = el.querySelector('.c-str');
    expect(str?.textContent).toBe('"hi"');
  });

  it('highlights single-quoted strings', () => {
    const el = html(highlightNodes("msg = 'hi'"));
    const str = el.querySelector('.c-str');
    expect(str?.textContent).toBe("'hi'");
  });

  it('highlights // line comments', () => {
    const el = html(highlightNodes('x = 1 // count'));
    const com = el.querySelector('.c-com');
    expect(com?.textContent).toBe('// count');
  });

  it('highlights # python comments', () => {
    const el = html(highlightNodes('x = 1 # count'));
    const com = el.querySelector('.c-com');
    expect(com?.textContent).toBe('# count');
  });

  it('preserves the whole token text across multiple highlights', () => {
    const code = 'const greet = "hi" // comment';
    const el = html(highlightNodes(code));
    expect(el.textContent).toBe(code);
    expect(el.querySelectorAll('.c-key')).toHaveLength(1);
    expect(el.querySelectorAll('.c-str')).toHaveLength(1);
    expect(el.querySelectorAll('.c-com')).toHaveLength(1);
  });

  it('handles python keywords', () => {
    const el = html(highlightNodes('def foo(): return 1'));
    expect(el.querySelectorAll('.c-key')).toHaveLength(2); // def, return
  });

  it('returns empty array for empty string', () => {
    expect(highlightNodes('')).toEqual([]);
  });
});
