import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewSessionPanel } from './NewSessionPanel';

describe('<NewSessionPanel>', () => {
  it('renders the header and disabled Create button when no path is chosen', () => {
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    expect(screen.getByRole('heading', { name: /new session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create session/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={onClose} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the X close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={onClose} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /close new session panel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the FolderPicker when Browse is clicked', async () => {
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    expect(screen.queryByTestId('folder-picker')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /browse/i }));
    expect(screen.getByTestId('folder-picker')).toBeInTheDocument();
  });

  it('enables Create once a folder is picked and submits with the draft', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await user.click(screen.getByText('Documents'));
    const create = screen.getByRole('button', { name: /create session/i });
    expect(create).not.toBeDisabled();
    await user.click(create);
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Documents session',
      path: '~/Documents',
      model: 'claude-sonnet-4-6',
      systemPrompt: '',
    });
  });

  it('uses the typed name over the auto-suggested one', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await user.click(screen.getByText('Documents'));
    await user.type(screen.getByLabelText(/session name/i), 'my custom name');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my custom name' }),
    );
  });

  it('switches the selected model', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await user.click(screen.getByText('Documents'));
    await user.click(screen.getByRole('radio', { name: /Claude Opus 4\.6/ }));
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-6' }),
    );
  });

  it('passes the system prompt through trimmed', async () => {
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await user.click(screen.getByText('Documents'));
    await user.type(screen.getByLabelText(/system prompt/i), '  be terse.  ');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: 'be terse.' }),
    );
  });
});
