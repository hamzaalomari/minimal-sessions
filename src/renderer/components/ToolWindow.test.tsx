import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToolWindow } from './ToolWindow';

describe('<ToolWindow>', () => {
  it('renders the verb, path and tag', () => {
    render(<ToolWindow kind="read" path="src/index.ts" tag="42 lines" />);
    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
    expect(screen.getByText('42 lines')).toBeInTheDocument();
  });

  it('uses the right verb for each tool kind', () => {
    const { rerender } = render(<ToolWindow kind="edit" path="x" />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    rerender(<ToolWindow kind="write" path="x" />);
    expect(screen.getByText('Wrote')).toBeInTheDocument();
    rerender(<ToolWindow kind="search" path="x" />);
    expect(screen.getByText('Searched')).toBeInTheDocument();
  });

  it('shows the summary line when provided', () => {
    render(<ToolWindow kind="read" path="x" summary="Read the entry point" />);
    expect(screen.getByText('Read the entry point')).toBeInTheDocument();
  });

  it('is collapsed by default and toggles open on click', async () => {
    const user = userEvent.setup();
    render(<ToolWindow kind="read" path="x.ts" code='const x = 1' />);
    expect(screen.queryByText(/const/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(screen.getByText(/const/)).toBeInTheDocument();
  });

  it('respects defaultOpen', () => {
    render(<ToolWindow kind="read" path="x.ts" code='const x = 1' defaultOpen />);
    expect(screen.getByText(/const/)).toBeInTheDocument();
  });

  it('renders a diff body when diff is provided', () => {
    const { container } = render(
      <ToolWindow kind="edit" path="x.ts" diff={'+a\n-b'} defaultOpen />,
    );
    expect(container.querySelectorAll('.diff-line')).toHaveLength(2);
  });

  it('disables the toggle and hides the chevron when there is no body', () => {
    const { container } = render(<ToolWindow kind="read" path="x.ts" tag="42 lines" />);
    const btn = container.querySelector('.toolwin-hd');
    expect(btn).toBeDisabled();
    expect(container.querySelector('.tw-chev')).toBeNull();
  });

  it('marks "passed" tags as ok and edit tags as diff', () => {
    const { container, rerender } = render(
      <ToolWindow kind="read" path="x" tag="all passed" />,
    );
    expect(container.querySelector('.tw-tag')).toHaveClass('ok');
    rerender(<ToolWindow kind="edit" path="x" tag="+9 −3" />);
    expect(container.querySelector('.tw-tag')).toHaveClass('diff');
  });
});
