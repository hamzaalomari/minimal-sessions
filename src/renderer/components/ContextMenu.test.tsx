import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

const baseProps = {
  anchor: { left: 10, top: 20 },
  canCloseTab: true,
  onRename: vi.fn(),
  onCloseTab: vi.fn(),
  onDelete: vi.fn(),
  onClose: vi.fn(),
};

describe('<ContextMenu>', () => {
  it('renders Rename, Close tab and Delete session items', () => {
    render(<ContextMenu {...baseProps} />);
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close tab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete session/i })).toBeInTheDocument();
  });

  it('hides Close tab when canCloseTab=false', () => {
    render(<ContextMenu {...baseProps} canCloseTab={false} />);
    expect(screen.queryByRole('button', { name: /close tab/i })).not.toBeInTheDocument();
  });

  it('calls onRename then onClose when Rename is clicked', async () => {
    const onRename = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ContextMenu {...baseProps} onRename={onRename} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /rename/i }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete then onClose when Delete is clicked', async () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ContextMenu {...baseProps} onDelete={onDelete} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /delete session/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('positions itself at the supplied anchor coordinates', () => {
    render(<ContextMenu {...baseProps} anchor={{ left: 42, top: 99 }} />);
    const menu = screen.getByTestId('context-menu');
    expect(menu.style.left).toBe('42px');
    expect(menu.style.top).toBe('99px');
  });

  it('closes on outside mousedown', () => {
    const onClose = vi.fn();
    render(
      <div>
        <ContextMenu {...baseProps} onClose={onClose} />
        <span data-testid="outside">outside</span>
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ContextMenu {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
