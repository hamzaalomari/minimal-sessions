import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@shared/types';
import { EditInstructionsModal } from './EditInstructionsModal';

const session: Session = {
  id: 's1',
  name: 'auth-service',
  path: '/Users/h/dev/auth',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'You answer in haiku.',
  branch: '',
  createdAt: 0,
  lastActiveAt: 0,
  tokens: 0,
  turns: [],
};

describe('<EditInstructionsModal>', () => {
  it('prefills the textarea with the existing systemPrompt', () => {
    render(
      <EditInstructionsModal session={session} onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.getByLabelText(/system prompt/i)).toHaveValue('You answer in haiku.');
  });

  it('saves the trimmed prompt on Save', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<EditInstructionsModal session={session} onClose={vi.fn()} onSave={onSave} />);
    const ta = screen.getByLabelText(/system prompt/i);
    await user.clear(ta);
    await user.type(ta, '   Be brief.   ');
    await user.click(screen.getByTestId('edit-instructions-save'));
    expect(onSave).toHaveBeenCalledWith('Be brief.');
  });

  it('closes without saving when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<EditInstructionsModal session={session} onClose={onClose} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
