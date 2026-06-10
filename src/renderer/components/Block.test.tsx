import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Block as BlockT } from '@shared/types';
import { Block } from './Block';

describe('<Block>', () => {
  it('renders a p block with inline markdown', () => {
    const b: BlockT = { type: 'p', text: 'be **bold**' };
    const { container } = render(<Block block={b} />);
    expect(container.querySelector('p')?.textContent).toBe('be bold');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('re-parses a p block that contains block-level markdown', () => {
    const b: BlockT = {
      type: 'p',
      text: '### Project\n\n- one\n- two',
    };
    const { container } = render(<Block block={b} />);
    expect(container.querySelector('h4')?.textContent).toBe('Project');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders a GFM table embedded in a p block', () => {
    const b: BlockT = {
      type: 'p',
      text: '| A | B |\n|---|---|\n| 1 | 2 |',
    };
    const { container } = render(<Block block={b} />);
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('renders a table block directly with inline markdown in cells', () => {
    const b: BlockT = {
      type: 'table',
      headers: ['Name', 'Code'],
      rows: [['**Bob**', '`x()`']],
    };
    const { container } = render(<Block block={b} />);
    expect(container.querySelector('td strong')?.textContent).toBe('Bob');
    expect(container.querySelector('td code')?.textContent).toBe('x()');
  });

  it('leaves a plain inline-only p block as a single <p>', () => {
    const b: BlockT = { type: 'p', text: 'just text with **bold**' };
    const { container } = render(<Block block={b} />);
    expect(container.querySelectorAll('h4')).toHaveLength(0);
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('renders an h block as <h4>', () => {
    const b: BlockT = { type: 'h', text: 'Section' };
    render(<Block block={b} />);
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Section');
  });

  it('renders a ul block with list items and inline markdown', () => {
    const b: BlockT = { type: 'ul', items: ['one', '**two**', 'three'] };
    const { container } = render(<Block block={b} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[1]?.querySelector('strong')?.textContent).toBe('two');
  });

  it('renders a code block', () => {
    const b: BlockT = { type: 'code', lang: 'ts', code: 'const x = 1' };
    const { container } = render(<Block block={b} />);
    expect(container.querySelector('.code-block')).not.toBeNull();
    expect(container.querySelector('.code-head')?.textContent).toContain('ts');
  });

  it('renders a tool line', () => {
    const b: BlockT = { type: 'tool', label: 'Edit', path: 'src/app.ts', tag: '+3 −1' };
    const { container } = render(<Block block={b} />);
    expect(container.querySelector('.tool-line')).not.toBeNull();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('src/app.ts')).toBeInTheDocument();
    expect(screen.getByText('+3 −1')).toBeInTheDocument();
  });

  it('renders a win block as a ToolWindow', () => {
    const b: BlockT = {
      type: 'win',
      kind: 'read',
      path: 'src/index.ts',
      tag: '42 lines',
      summary: 'Read entry',
    };
    const { container } = render(<Block block={b} />);
    expect(container.querySelector('.toolwin')).not.toBeNull();
    expect(screen.getByText('Read entry')).toBeInTheDocument();
  });

  it('renders an error block with role="alert"', () => {
    const b: BlockT = { type: 'error', message: 'Something failed' };
    render(<Block block={b} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something failed');
  });
});
