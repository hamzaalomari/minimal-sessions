import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Session } from '@shared/types';
import { SessionHead } from './SessionHead';

const baseSession: Session = {
  id: 's1',
  name: 'auth-service refactor',
  model: 'claude-sonnet-4-6',
  systemPrompt: '',
  path: '~/dev/acme/auth-service',
  branch: 'feat/session-store',
  createdAt: 0,
  lastActiveAt: 0,
  tokens: 0,
  turns: [],
};

describe('<SessionHead>', () => {
  it('renders the session name as the heading', () => {
    render(<SessionHead session={baseSession} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('auth-service refactor');
  });

  it('renders the model long name', () => {
    render(<SessionHead session={baseSession} />);
    expect(screen.getByText('Claude Sonnet 4.6')).toBeInTheDocument();
  });

  it('renders path and branch chips', () => {
    render(<SessionHead session={baseSession} />);
    expect(screen.getByText('~/dev/acme/auth-service')).toBeInTheDocument();
    expect(screen.getByText('feat/session-store')).toBeInTheDocument();
  });

  it('omits the path chip when path is empty', () => {
    render(<SessionHead session={{ ...baseSession, path: '' }} />);
    expect(screen.queryByText('~/dev/acme/auth-service')).not.toBeInTheDocument();
  });

  it('omits the branch chip when branch is empty', () => {
    render(<SessionHead session={{ ...baseSession, branch: '' }} />);
    expect(screen.queryByText('feat/session-store')).not.toBeInTheDocument();
  });

  it('falls back to the model id when the model is unknown', () => {
    render(<SessionHead session={{ ...baseSession, model: 'claude-mystery-9-9' }} />);
    expect(screen.getByText('claude-mystery-9-9')).toBeInTheDocument();
  });
});
