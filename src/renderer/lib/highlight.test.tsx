import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { highlightNodes } from './highlight';

function html(nodes: ReactNode): HTMLElement {
  return render(<div>{nodes}</div>).container.firstChild as HTMLElement;
}

describe('highlightNodes', () => {
  it('preserves text content for plain text', () => {
    const el = html(highlightNodes('foo bar baz'));
    expect(el.textContent).toBe('foo bar baz');
  });

  it('returns a node wrapped with the hljs root class', () => {
    const el = html(highlightNodes('foo', 'plaintext'));
    expect(el.querySelector('.hljs')).not.toBeNull();
  });

  it('emits hljs-keyword spans for JS keywords', () => {
    const el = html(highlightNodes('const x = 1', 'javascript'));
    const keyword = el.querySelector('.hljs-keyword');
    expect(keyword?.textContent).toBe('const');
    expect(el.textContent).toBe('const x = 1');
  });

  it('emits hljs-string spans for string literals', () => {
    const el = html(highlightNodes('const msg = "hi"', 'javascript'));
    const str = el.querySelector('.hljs-string');
    expect(str?.textContent).toBe('"hi"');
  });

  it('emits hljs-comment spans for line comments', () => {
    const el = html(highlightNodes('x = 1 // count', 'javascript'));
    const com = el.querySelector('.hljs-comment');
    expect(com?.textContent).toBe('// count');
  });

  it('highlights python keywords', () => {
    const el = html(highlightNodes('def foo(): return 1', 'python'));
    expect(el.querySelectorAll('.hljs-keyword').length).toBeGreaterThanOrEqual(2);
  });

  it('resolves common language aliases (ts → typescript)', () => {
    const el = html(highlightNodes('const x: number = 1', 'ts'));
    expect(el.querySelector('.hljs.language-typescript')).not.toBeNull();
  });

  it('falls back to plaintext when given an unknown language', () => {
    const el = html(highlightNodes('whatever', 'made-up-lang'));
    expect(el.textContent).toBe('whatever');
  });

  it('handles empty string without throwing', () => {
    const nodes = highlightNodes('', 'plaintext');
    expect(nodes.length).toBe(1);
    const el = html(nodes);
    expect(el.textContent).toBe('');
  });
});
