import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderInline } from './markdown';

function html(nodes: ReactNode) {
  return render(<div>{nodes}</div>).container.firstChild as HTMLElement;
}

describe('renderInline', () => {
  it('returns plain text unchanged', () => {
    const el = html(renderInline('hello world'));
    expect(el.textContent).toBe('hello world');
    expect(el.querySelector('strong')).toBeNull();
    expect(el.querySelector('code')).toBeNull();
  });

  it('renders **bold** as <strong>', () => {
    const el = html(renderInline('be **bold** now'));
    const strong = el.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('bold');
    expect(el.textContent).toBe('be bold now');
  });

  it('renders `code` as <code class="inline">', () => {
    const el = html(renderInline('use `npm test` for tests'));
    const code = el.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe('npm test');
    expect(code?.className).toBe('inline');
  });

  it('handles multiple bold and code segments interleaved', () => {
    const el = html(renderInline('**a** then `b` then **c**'));
    expect(el.querySelectorAll('strong')).toHaveLength(2);
    expect(el.querySelectorAll('code')).toHaveLength(1);
    expect(el.textContent).toBe('a then b then c');
  });

  it('leaves unmatched asterisks alone', () => {
    const el = html(renderInline('not *italic*'));
    expect(el.querySelector('strong')).toBeNull();
    expect(el.textContent).toBe('not *italic*');
  });

  it('returns empty array for empty string', () => {
    const out = renderInline('');
    expect(out).toEqual([]);
  });
});
