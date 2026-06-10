import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelPicker } from './ModelPicker';

function installModelsApi(models: { id: string; displayName: string; description: string }[]) {
  (window as unknown as { api: unknown }).api = {
    models: { list: vi.fn().mockResolvedValue(models) },
  };
}

describe('<ModelPicker>', () => {
  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it('shows the current selection in the trigger', () => {
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger).toHaveTextContent(/Claude Sonnet 4\.6/);
  });

  it('opens the panel on click and lists the local catalog by default', async () => {
    const user = userEvent.setup();
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    await user.click(screen.getByRole('button', { expanded: false }));
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(3);
    const selected = options.find((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveTextContent(/Claude Sonnet 4\.6/);
  });

  it('calls onChange and closes the panel when an option is selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ModelPicker value="claude-sonnet-4-6" onChange={onChange} />);
    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('option', { name: /Claude Haiku 4\.5/ }));
    expect(onChange).toHaveBeenCalledWith('claude-haiku-4-5');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('replaces the local list with the SDK-supplied models once available', async () => {
    installModelsApi([
      { id: 'claude-foo-1', displayName: 'Claude Foo', description: 'one' },
      { id: 'claude-bar-2', displayName: 'Claude Bar', description: 'two' },
    ]);
    const user = userEvent.setup();
    render(<ModelPicker value="claude-foo-1" onChange={() => {}} />);
    await waitFor(() =>
      expect(window.api.models.list).toHaveBeenCalled(),
    );
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('option', { name: /Claude Foo/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Claude Bar/ })).toBeInTheDocument();
  });

  it('keeps the current value as an option even if the SDK list omits it', async () => {
    installModelsApi([
      { id: 'claude-bar-2', displayName: 'Claude Bar', description: 'two' },
    ]);
    const user = userEvent.setup();
    render(<ModelPicker value="claude-not-in-list" onChange={() => {}} />);
    await waitFor(() => expect(window.api.models.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { expanded: false }));
    const selected = screen
      .getAllByRole('option')
      .find((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveTextContent('claude-not-in-list');
  });

  it('renders a footer error when the SDK call rejects', async () => {
    (window as unknown as { api: unknown }).api = {
      models: { list: vi.fn().mockRejectedValue(new Error('boom')) },
    };
    const user = userEvent.setup();
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    await waitFor(() => expect(window.api.models.list).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
