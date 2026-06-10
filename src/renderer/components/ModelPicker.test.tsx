import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelPicker } from './ModelPicker';

function installModelsApi(models: { id: string; displayName: string; description: string }[]) {
  (window as unknown as { api: unknown }).api = {
    models: {
      list: vi.fn().mockResolvedValue(models),
    },
  };
}

describe('<ModelPicker>', () => {
  beforeEach(() => {
    // Clean state; tests that want the api install it explicitly.
  });
  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it('renders a <select> seeded with the local catalog by default', () => {
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    const select = screen.getByRole('combobox', { name: /model/i });
    expect(select).toHaveValue('claude-sonnet-4-6');
    // Local catalog has at least the three Claude 4.6 / 4.5 models.
    expect(select.querySelectorAll('option').length).toBeGreaterThanOrEqual(3);
  });

  it('emits onChange with the chosen model id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ModelPicker value="claude-sonnet-4-6" onChange={onChange} />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: /model/i }),
      'claude-haiku-4-5',
    );
    expect(onChange).toHaveBeenCalledWith('claude-haiku-4-5');
  });

  it('replaces the local list with the SDK-supplied models once available', async () => {
    installModelsApi([
      { id: 'claude-foo-1', displayName: 'Claude Foo', description: 'one' },
      { id: 'claude-bar-2', displayName: 'Claude Bar', description: 'two' },
    ]);
    render(<ModelPicker value="claude-foo-1" onChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Claude Foo/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Claude Bar/)).toBeInTheDocument();
  });

  it('keeps the current value as an option even if the SDK list omits it', async () => {
    installModelsApi([
      { id: 'claude-bar-2', displayName: 'Claude Bar', description: 'two' },
    ]);
    render(<ModelPicker value="claude-not-in-list" onChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Claude Bar/)).toBeInTheDocument();
    });
    const select = screen.getByRole('combobox', { name: /model/i });
    expect(select).toHaveValue('claude-not-in-list');
  });

  it('falls back to local models if the SDK call rejects', async () => {
    (window as unknown as { api: unknown }).api = {
      models: { list: vi.fn().mockRejectedValue(new Error('boom')) },
    };
    render(<ModelPicker value="claude-sonnet-4-6" onChange={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const select = screen.getByRole('combobox', { name: /model/i });
    expect(select.querySelectorAll('option').length).toBeGreaterThanOrEqual(3);
  });
});
