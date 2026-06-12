import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeBlock } from './CodeBlock';

describe('<CodeBlock>', () => {
  it('renders the language label in the header', () => {
    const { container } = render(<CodeBlock lang="typescript" code="const x = 1" />);
    expect(container.querySelector('.code-head')).toHaveTextContent('typescript');
  });

  it('renders the code body with highlighting', () => {
    const { container } = render(<CodeBlock lang="javascript" code='const greet = "hi"' />);
    const body = container.querySelector('.code-body');
    expect(body).toHaveTextContent('const greet = "hi"');
    expect(body?.querySelector('.hljs-keyword')).toHaveTextContent('const');
    expect(body?.querySelector('.hljs-string')).toHaveTextContent('"hi"');
  });

  it('shows a copy icon in the header', () => {
    const { container } = render(<CodeBlock lang="shell" code="ls" />);
    const head = container.querySelector('.code-head');
    expect(head?.querySelector('svg')).not.toBeNull();
  });

  it('preserves multi-line code as-is', () => {
    const code = 'line one\nline two\nline three';
    const { container } = render(<CodeBlock lang="text" code={code} />);
    expect(container.querySelector('.code-body')).toHaveTextContent(/line one.*line two.*line three/s);
  });
});
