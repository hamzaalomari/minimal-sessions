import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FolderPicker } from './FolderPicker';

describe('<FolderPicker>', () => {
  it('starts at the home directory and lists its children', () => {
    render(<FolderPicker onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText('~', { selector: '.finder-crumbs' })).toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('sandbox')).toBeInTheDocument();
  });

  it('descends into a folder with children', async () => {
    const user = userEvent.setup();
    render(<FolderPicker onPick={() => {}} onClose={() => {}} />);
    await user.click(screen.getByText('dev'));
    expect(screen.getByText('~/dev', { selector: '.finder-crumbs' })).toBeInTheDocument();
    expect(screen.getByText('acme')).toBeInTheDocument();
  });

  it('picks a leaf folder by clicking it', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<FolderPicker onPick={onPick} onClose={() => {}} />);
    await user.click(screen.getByText('Documents'));
    expect(onPick).toHaveBeenCalledWith('~/Documents');
  });

  it('navigates up via the Back button', async () => {
    const user = userEvent.setup();
    render(<FolderPicker onPick={() => {}} onClose={() => {}} />);
    await user.click(screen.getByText('dev'));
    await user.click(screen.getByText('Back'));
    expect(screen.getByText('~', { selector: '.finder-crumbs' })).toBeInTheDocument();
  });

  it('Open button picks the current cwd', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<FolderPicker onPick={onPick} onClose={() => {}} />);
    await user.click(screen.getByText('dev'));
    await user.click(screen.getByRole('button', { name: /Open “dev”/ }));
    expect(onPick).toHaveBeenCalledWith('~/dev');
  });

  it('Cancel button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<FolderPicker onPick={() => {}} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
