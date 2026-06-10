import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ModelId } from '@shared/types';
import { Icon } from './Icon';
import { ModelPicker } from './ModelPicker';
import { SystemPromptField } from './SystemPromptField';
import { useHomeDir } from '../state/sessions';
import { basename, displayPath } from '../lib/paths';

export interface NewSessionDraft {
  name: string;
  path: string;
  branch: string;
  model: ModelId;
  systemPrompt: string;
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
  const [error, setError] = useState<string>('');
  const [picking, setPicking] = useState(false);

  const suggested = suggestNameFromPath(path);
  const effectiveName = name.trim() || suggested;
  const canCreate = Boolean(path && effectiveName);
  const shownPath = path ? displayPath(path, home) : '';

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
