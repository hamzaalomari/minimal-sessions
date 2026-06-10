import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSessionPanel } from './NewSessionPanel';
import { useSessions } from '../state/sessions';

interface FsMocks {
  pickDirectory: ReturnType<typeof vi.fn>;
  branchFor: ReturnType<typeof vi.fn>;
  isReadableDir: ReturnType<typeof vi.fn>;
}

function installFsApi(overrides: Partial<FsMocks> = {}): FsMocks {
  const mocks: FsMocks = {
    pickDirectory: vi.fn().mockResolvedValue('/Users/h/dev/acme'),
    branchFor: vi.fn().mockResolvedValue('main'),
    isReadableDir: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  (window as unknown as { api: unknown }).api = {
    fs: mocks,
  };
  return mocks;
}

describe('<NewSessionPanel>', () => {
  beforeEach(() => {
    useSessions.setState({ home: '/Users/h' });
  });

  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api;
  });

  it('renders the header and disabled Create button when no path is chosen', () => {
    installFsApi();
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    expect(screen.getByRole('heading', { name: /new session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create session/i })).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    installFsApi();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={onClose} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', async () => {
    installFsApi();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={onClose} onCreate={() => {}} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the X close button is clicked', async () => {
    installFsApi();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={onClose} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /close new session panel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Browse… calls the native picker and fills the path field', async () => {
    const mocks = installFsApi();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await waitFor(() => expect(mocks.pickDirectory).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('~/dev/acme')).toBeInTheDocument();
  });

  it('shows the branch chip when fs.branchFor returns one', async () => {
    installFsApi({ branchFor: vi.fn().mockResolvedValue('feature/x') });
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    expect(await screen.findByText('feature/x')).toBeInTheDocument();
  });

  it('does NOT render a branch chip when fs.branchFor returns empty', async () => {
    installFsApi({ branchFor: vi.fn().mockResolvedValue('') });
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await screen.findByText('~/dev/acme');
    // No path-branch chip; the branch icon would only appear inside one.
    expect(document.querySelector('.path-branch')).toBeNull();
  });

  it('shows an inline error and does not set the path when the dir is not readable', async () => {
    installFsApi({ isReadableDir: vi.fn().mockResolvedValue(false) });
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot read/i);
    expect(screen.getByRole('button', { name: /create session/i })).toBeDisabled();
  });

  it('does nothing when the user cancels the picker', async () => {
    installFsApi({ pickDirectory: vi.fn().mockResolvedValue(null) });
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={() => {}} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    expect(screen.getByText('No folder selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create session/i })).toBeDisabled();
  });

  it('submits the draft with path, branch, suggested name, default model, empty prompt', async () => {
    installFsApi();
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await screen.findByText('~/dev/acme');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(onCreate).toHaveBeenCalledWith({
      name: 'acme session',
      path: '/Users/h/dev/acme',
      branch: 'main',
      model: 'claude-sonnet-4-6',
      systemPrompt: '',
    });
  });

  it('uses the typed name over the auto-suggested one', async () => {
    installFsApi();
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await screen.findByText('~/dev/acme');
    await user.type(screen.getByLabelText(/session name/i), 'my custom name');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'my custom name' }),
    );
  });

  it('switches the selected model', async () => {
    installFsApi();
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await screen.findByText('~/dev/acme');
    // Open the model dropdown and pick Opus.
    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('option', { name: /Claude Opus 4\.6/ }));
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-6' }),
    );
  });

  it('passes the system prompt through trimmed', async () => {
    installFsApi();
    const onCreate = vi.fn();
    const user = userEvent.setup();
    render(<NewSessionPanel onClose={() => {}} onCreate={onCreate} />);
    await user.click(screen.getByRole('button', { name: /browse/i }));
    await screen.findByText('~/dev/acme');
    await user.type(screen.getByLabelText(/system prompt/i), '  be terse.  ');
    await user.click(screen.getByRole('button', { name: /create session/i }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ systemPrompt: 'be terse.' }),
    );
  });
});
