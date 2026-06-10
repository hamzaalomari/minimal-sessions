import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SystemPromptField } from './SystemPromptField';

describe('<SystemPromptField>', () => {
  it('renders the label and textarea', () => {
    render(<SystemPromptField value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
  });

  it('shows "Optional" hint when empty', () => {
    render(<SystemPromptField value="" onChange={() => {}} />);
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it('shows character count when non-empty', () => {
    render(<SystemPromptField value="hello" onChange={() => {}} />);
    expect(screen.getByText(/5 characters/)).toBeInTheDocument();
  });

  it('calls onChange when the textarea changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SystemPromptField value="" onChange={onChange} />);
    await user.type(screen.getByLabelText(/system prompt/i), 'h');
    expect(onChange).toHaveBeenCalledWith('h');
  });

  it('renders the supplied placeholder', () => {
    render(<SystemPromptField value="" onChange={() => {}} placeholder="Be helpful." />);
    expect(screen.getByPlaceholderText('Be helpful.')).toBeInTheDocument();
  });
});
