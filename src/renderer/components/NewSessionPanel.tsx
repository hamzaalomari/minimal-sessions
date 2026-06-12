import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ModelId } from '@shared/types';
import { Icon } from './Icon';
import { ModelPicker } from './ModelPicker';
import { SystemPromptField } from './SystemPromptField';
import { useHomeDir } from '../state/sessions';
import { basename, displayPath } from '../lib/paths';

export type GitMode = 'none' | 'branch' | 'worktree';

export interface NewSessionDraft {
  name: string;
  path: string;
  branch: string;
  model: ModelId;
  systemPrompt: string;
  /** Git side-effect to run before the session opens. */
  git: { mode: GitMode; name?: string };
}

interface NewSessionPanelProps {
  onClose(): void;
  onCreate(draft: NewSessionDraft): void;
  defaultModel?: ModelId;
}

function suggestNameFromPath(path: string): string {
  const leaf = basename(path);
  if (!leaf) return '';
  return leaf.replace(/[-_]/g, ' ') + ' session';
}

export function NewSessionPanel({
  onClose,
  onCreate,
  defaultModel = 'claude-sonnet-4-6',
}: NewSessionPanelProps) {
  const home = useHomeDir();
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('');
  const [model, setModel] = useState<ModelId>(defaultModel);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [gitMode, setGitMode] = useState<GitMode>('none');
  const [gitName, setGitName] = useState('');
  const [error, setError] = useState<string>('');
  const [picking, setPicking] = useState(false);

  const suggested = suggestNameFromPath(path);
  const effectiveName = name.trim() || suggested;
  const trimmedGitName = gitName.trim();
  const needsGitName = gitMode !== 'none';
  const canCreate = Boolean(
    path && effectiveName && (!needsGitName || trimmedGitName),
  );
  const shownPath = path ? displayPath(path, home) : '';
  // Preview of the resolved path when the user picks "worktree" — drops next
  // to the working folder so they know where it'll land. Empty otherwise.
  const worktreePreview =
    gitMode === 'worktree' && path && trimmedGitName
      ? `${path}-${trimmedGitName}`
      : '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBrowse = async () => {
    if (picking) return;
    setPicking(true);
    setError('');
    try {
      const picked = await window.api.fs.pickDirectory();
      if (!picked) return;
      const readable = await window.api.fs.isReadableDir(picked);
      if (!readable) {
        setError(`Cannot read ${picked}`);
        return;
      }
      setPath(picked);
      const b = await window.api.fs.branchFor(picked);
      setBranch(b);
    } catch {
      setError('Could not open the folder picker');
    } finally {
      setPicking(false);
    }
  };

  const submit = () => {
    if (!canCreate) return;
    onCreate({
      name: effectiveName,
      path,
      branch,
      model,
      systemPrompt: systemPrompt.trim(),
      git: { mode: gitMode, ...(needsGitName ? { name: trimmedGitName } : {}) },
    });
  };

  const node = (
    <>
      <div className="ns-scrim" onClick={onClose} data-testid="ns-scrim" />
      <aside
        className="ns-panel"
        role="dialog"
        aria-label="New session"
        data-testid="new-session-panel"
      >
        <div className="ns-hd">
          <div>
            <h2>New session</h2>
            <p>Point Claude at a folder and pick a model to begin.</p>
          </div>
          <button
            type="button"
            className="ns-x"
            onClick={onClose}
            aria-label="Close new session panel"
          >
            <Icon name="x" />
          </button>
        </div>

        <div className="ns-body scroll">
          <div className="ns-field">
            <label className="ns-label" htmlFor="ns-name">
              Session name
            </label>
            <input
              id="ns-name"
              className="ns-input"
              autoFocus
              value={name}
              placeholder={suggested || 'e.g. auth-service refactor'}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="ns-field">
            <label className="ns-label">
              Working folder <span className="req">*</span>
            </label>
            <div className="browse-row">
              <div className={'path-field' + (path ? '' : ' empty')}>
                <Icon name="folder" />
                <span>{shownPath || 'No folder selected'}</span>
                {branch && (
                  <span className="path-branch">
                    <Icon name="branch" />
                    {branch}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="browse-btn"
                onClick={handleBrowse}
                disabled={picking}
              >
                Browse…
              </button>
            </div>
            {error && (
              <div className="ns-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="ns-field">
            <label className="ns-label">Branch strategy</label>
            <div
              className="ns-seg"
              role="radiogroup"
              aria-label="Branch strategy"
            >
              <button
                type="button"
                role="radio"
                aria-checked={gitMode === 'none'}
                className={'ns-seg-btn' + (gitMode === 'none' ? ' on' : '')}
                onClick={() => setGitMode('none')}
              >
                <Icon name="branch" />
                <span>Use current</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={gitMode === 'branch'}
                className={'ns-seg-btn' + (gitMode === 'branch' ? ' on' : '')}
                onClick={() => setGitMode('branch')}
              >
                <Icon name="branch" />
                <span>New branch</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={gitMode === 'worktree'}
                className={'ns-seg-btn' + (gitMode === 'worktree' ? ' on' : '')}
                onClick={() => setGitMode('worktree')}
              >
                <Icon name="folder" />
                <span>New worktree</span>
              </button>
            </div>
            {needsGitName && (
              <>
                <input
                  className="ns-input ns-git-name"
                  value={gitName}
                  placeholder={
                    gitMode === 'branch' ? 'e.g. feature/login' : 'e.g. feature-x'
                  }
                  onChange={(e) => setGitName(e.target.value)}
                />
                {worktreePreview && (
                  <div className="ns-hint">
                    Worktree will be created at{' '}
                    <code>{displayPath(worktreePreview, home)}</code>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="ns-field">
            <label className="ns-label">Model</label>
            <ModelPicker value={model} onChange={setModel} />
          </div>

          <SystemPromptField value={systemPrompt} onChange={setSystemPrompt} />
        </div>

        <div className="ns-foot">
          <div className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canCreate}
            onClick={submit}
          >
            Create session
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(node, document.body);
}
