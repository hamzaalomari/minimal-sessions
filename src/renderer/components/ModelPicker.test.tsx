import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModelPicker } from './ModelPicker';

describe('<ModelPicker>', () => {
  it('renders one card per model', () => {
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(3);
  });

  it('marks the selected model as checked', () => {
    render(<ModelPicker value="claude-opus-4-6" onChange={() => {}} />);
    const opus = screen.getByRole('radio', { name: /Claude Opus 4\.6/ });
    const sonnet = screen.getByRole('radio', { name: /Claude Sonnet 4\.6/ });
    expect(opus).toHaveAttribute('aria-checked', 'true');
    expect(sonnet).toHaveAttribute('aria-checked', 'false');
    expect(opus.className).toContain('sel');
  });

  it('calls onChange with the model id when a card is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ModelPicker value="claude-sonnet-4-6" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: /Claude Haiku 4\.5/ }));
    expect(onChange).toHaveBeenCalledWith('claude-haiku-4-5');
  });

  it('shows tier and description text', () => {
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    expect(screen.getByText('Most capable')).toBeInTheDocument();
    expect(screen.getByText(/balanced/i)).toBeInTheDocument();
    expect(screen.getByText(/Fastest/i)).toBeInTheDocument();
  });
});
