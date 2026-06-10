import { useState } from 'react';
import type { ModelId } from '@shared/types';
import { FolderPicker } from './FolderPicker';
import { Icon } from './Icon';
import { ModelPicker } from './ModelPicker';
import { SystemPromptField } from './SystemPromptField';

export interface NewSessionDraft {
  name: string;
  path: string;
  model: ModelId;
  systemPrompt: string;
}

interface NewSessionPanelProps {
  onClose(): void;
  onCreate(draft: NewSessionDraft): void;
  defaultModel?: ModelId;
}

function suggestNameFromPath(path: string): string {
  if (!path) return '';
  const leaf = path.split('/').pop() ?? '';
  return leaf.replace(/[-_]/g, ' ') + ' session';
}

export function NewSessionPanel({
  onClose,
  onCreate,
  defaultModel = 'claude-sonnet-4-6',
}: NewSessionPanelProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [model, setModel] = useState<ModelId>(defaultModel);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [finder, setFinder] = useState(false);

  const suggested = suggestNameFromPath(path);
  const effectiveName = name.trim() || suggested;
  const canCreate = Boolean(path && effectiveName);

  const submit = () => {
    if (!canCreate) return;
    onCreate({ name: effectiveName, path, model, systemPrompt: systemPrompt.trim() });
  };

  return (
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
                <span>{path || 'No folder selected'}</span>
              </div>
              <button
                type="button"
                className="browse-btn"
                onClick={() => setFinder(true)}
              >
                Browse…
              </button>
            </div>
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

      {finder && (
        <FolderPicker
          onPick={(p) => {
            setPath(p);
            setFinder(false);
          }}
          onClose={() => setFinder(false)}
        />
      )}
    </>
  );
}
