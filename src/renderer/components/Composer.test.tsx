import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@shared/types';
import { Composer } from './Composer';

const session: Session = {
  id: 's1',
  name: 'demo',
  model: 'claude-sonnet-4-6',
  systemPrompt: '',
  path: '~/dev/acme/auth-service',
  branch: 'main',
  createdAt: 0,
  lastActiveAt: 0,
  tokens: 0,
  turns: [],
};

describe('<Composer>', () => {
  it('shows the folder name in the placeholder', () => {
    render(<Composer session={session} value="" onChange={() => {}} onSend={() => {}} />);
    expect(screen.getByPlaceholderText(/Message Claude about auth-service/)).toBeInTheDocument();
  });

  it('shows the model short label', () => {
    render(<Composer session={session} value="" onChange={() => {}} onSend={() => {}} />);
    expect(screen.getByText('Sonnet')).toBeInTheDocument();
  });

  it('calls onChange when the user types', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Composer session={session} value="" onChange={onChange} onSend={() => {}} />);
    await user.type(screen.getByRole('textbox'), 'h');
    expect(onChange).toHaveBeenCalledWith('h');
  });

  it('disables the send button when value is empty or whitespace', () => {
    const { rerender } = render(
      <Composer session={session} value="" onChange={() => {}} onSend={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
    rerender(<Composer session={session} value="   " onChange={() => {}} onSend={() => {}} />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('disables the send button while busy even with text', () => {
    render(<Composer session={session} value="hi" onChange={() => {}} onSend={() => {}} busy />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('enables the send button when value is non-empty and not busy', () => {
    render(<Composer session={session} value="hello" onChange={() => {}} onSend={() => {}} />);
    expect(screen.getByRole('button', { name: /send message/i })).not.toBeDisabled();
  });

  it('calls onSend when Enter is pressed', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Composer session={session} value="hello" onChange={() => {}} onSend={onSend} />);
    const ta = screen.getByRole('textbox');
    ta.focus();
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onSend on Shift+Enter (newline)', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Composer session={session} value="hello" onChange={() => {}} onSend={onSend} />);
    const ta = screen.getByRole('textbox');
    ta.focus();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onSend when the send button is clicked', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Composer session={session} value="hello" onChange={() => {}} onSend={onSend} />);
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('ignores Enter when value is empty', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<Composer session={session} value="" onChange={() => {}} onSend={onSend} />);
    const ta = screen.getByRole('textbox');
    ta.focus();
    await user.keyboard('{Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('applies the focus class when the textarea is focused', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Composer session={session} value="" onChange={() => {}} onSend={() => {}} />,
    );
    const box = container.querySelector('.composer-box');
    expect(box).not.toHaveClass('focus');
    await user.click(screen.getByRole('textbox'));
    expect(box).toHaveClass('focus');
  });

  it('shows the stop button (and hides send) when busy and onStop is provided', () => {
    render(
      <Composer
        session={session}
        value=""
        onChange={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        busy
      />,
    );
    expect(screen.getByRole('button', { name: /stop generating/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send message/i })).toBeNull();
  });

  it('keeps the disabled send button when busy without onStop', () => {
    render(<Composer session={session} value="hi" onChange={() => {}} onSend={() => {}} busy />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /stop generating/i })).toBeNull();
  });

  it('calls onStop when the stop button is clicked', async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(
      <Composer
        session={session}
        value=""
        onChange={() => {}}
        onSend={() => {}}
        onStop={onStop}
        busy
      />,
    );
    await user.click(screen.getByRole('button', { name: /stop generating/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('calls onStop when Escape is pressed while busy', async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(
      <Composer
        session={session}
        value=""
        onChange={() => {}}
        onSend={() => {}}
        onStop={onStop}
        busy
      />,
    );
    const ta = screen.getByRole('textbox');
    ta.focus();
    await user.keyboard('{Escape}');
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onStop on Escape when not busy', async () => {
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(
      <Composer
        session={session}
        value=""
        onChange={() => {}}
        onSend={() => {}}
        onStop={onStop}
      />,
    );
    const ta = screen.getByRole('textbox');
    ta.focus();
    await user.keyboard('{Escape}');
    expect(onStop).not.toHaveBeenCalled();
  });
});
