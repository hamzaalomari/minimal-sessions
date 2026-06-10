import type { Session } from '@shared/types';
import { Icon, type IconName } from './Icon';
import { getModel } from '../data/models';

interface Suggestion {
  icon: IconName;
  text: string;
}

const SUGGESTIONS: Suggestion[] = [
  { icon: 'search', text: 'Explain the structure of this codebase' },
  { icon: 'edit', text: 'Find and fix a bug in the current branch' },
  { icon: 'terminal', text: 'Write tests for the module I’m working on' },
];

interface EmptyStateProps {
  session: Session;
  onSuggest(text: string): void;
}

export function EmptyState({ session, onSuggest }: EmptyStateProps) {
  const m = getModel(session.model);
  const modelName = m?.name ?? session.model;
  return (
    <div className="empty" data-testid="empty-state">
      <div className="empty-card">
        <div className="empty-mark">
          <Icon name="spark" />
        </div>
        <h2>Start a conversation</h2>
        <p>{modelName} is ready in this folder.</p>
        <div className="empty-path">{session.path}</div>
        <div className="suggest">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              type="button"
              className="suggest-chip"
              onClick={() => onSuggest(s.text)}
            >
              <Icon name={s.icon} />
              {s.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
