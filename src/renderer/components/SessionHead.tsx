import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { getModel } from '../data/models';

interface SessionHeadProps {
  session: Session;
}

export function SessionHead({ session }: SessionHeadProps) {
  const m = getModel(session.model);
  const dot = m?.color ?? 'var(--faint)';
  const modelName = m?.name ?? session.model;

  return (
    <div className="session-head">
      <h1 className="sh-name">{session.name}</h1>
      <div className="sh-meta">
        <span className="sh-chip">
          <span className="sh-mdot" style={{ background: dot }} />
          {modelName}
        </span>
        {session.path && (
          <span className="sh-chip">
            <Icon name="folder" />
            <span className="sh-path">{session.path}</span>
          </span>
        )}
        {session.branch && (
          <span className="sh-chip">
            <Icon name="branch" />
            {session.branch}
          </span>
        )}
      </div>
    </div>
  );
}
