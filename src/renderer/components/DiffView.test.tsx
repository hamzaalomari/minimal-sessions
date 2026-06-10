import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiffView } from './DiffView';

const NBSP = ' ';

describe('<DiffView>', () => {
  it('renders + lines as add and - lines as del', () => {
    const { container } = render(<DiffView text={'+added\n-removed\n unchanged'} />);
    const lines = container.querySelectorAll('.diff-line');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveClass('add');
    expect(lines[1]).toHaveClass('del');
    expect(lines[2]).toHaveClass('ctx');
  });

  it('strips the diff marker from the line body', () => {
    const { container } = render(<DiffView text={'+hello'} />);
    const text = container.querySelector('.diff-text');
    expect(text?.textContent).toBe('hello');
  });

  it('shows + and − in the gutter for adds and dels', () => {
    const { container } = render(<DiffView text={'+a\n-b\n c'} />);
    const gutters = container.querySelectorAll('.diff-gutter');
    expect(gutters[0]?.textContent).toBe('+');
    expect(gutters[1]?.textContent).toBe('−');
    expect(gutters[2]?.textContent).toBe('');
  });

  it('renders empty bodies as a non-breaking space so the row keeps height', () => {
    const { container } = render(<DiffView text={'+\n a'} />);
    const text = container.querySelectorAll('.diff-text')[0];
    expect(text?.textContent).toBe(NBSP);
  });

  it('ignores a trailing newline', () => {
    const { container } = render(<DiffView text={'+a\n+b\n'} />);
    expect(container.querySelectorAll('.diff-line')).toHaveLength(2);
  });

  it('treats unmarked lines (no leading +/-/space) as context, keeping the full text', () => {
    const { container } = render(<DiffView text={'@@ -1 +1 @@'} />);
    const line = container.querySelector('.diff-line');
    expect(line).toHaveClass('ctx');
    expect(line?.querySelector('.diff-text')?.textContent).toBe('@@ -1 +1 @@');
  });
});
