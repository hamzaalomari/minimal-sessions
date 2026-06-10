import { useEffect, useState } from 'react';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { getModel } from '../data/models';
import { displayPath } from '../lib/paths';
import { useHomeDir } from '../state/sessions';

interface SessionHeadProps {
  session: Session;
}

export function SessionHead({ session }: SessionHeadProps) {
  const m = getModel(session.model);
  const dot = m?.color ?? 'var(--faint)';
  const modelName = m?.name ?? session.model;
  const home = useHomeDir();
  // null while we check; once we have an answer, drive the "folder missing"
  // chip below. Tilde-collapsed paths stay readable from the DB regardless.
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!session.path) {
      setExists(null);
      return;
    }
    void window.api?.fs
      ?.isReadableDir(session.path)
      .then((v) => {
        if (!cancelled) setExists(v);
      })
      .catch(() => {
        if (!cancelled) setExists(null);
      });
    return () => {
      cancelled = true;
    };
  }, [session.path]);

  const shownPath = session.path ? displayPath(session.path, home) : '';

  return (
    <div className="session-head">
      <h1 className="sh-name">{session.name}</h1>
      <div className="sh-meta">
        <span className="sh-chip">
          <span className="sh-mdot" style={{ background: dot }} />
          {modelName}
        </span>
        {session.path && (
          <span className="sh-chip" title={session.path}>
            <Icon name="folder" />
            <span className="sh-path">{shownPath}</span>
          </span>
        )}
        {session.branch && (
          <span className="sh-chip">
            <Icon name="branch" />
            {session.branch}
          </span>
        )}
        {exists === false && (
          <span className="sh-chip sh-chip-warn" data-testid="folder-missing">
            <Icon name="alert" />
            folder missing
          </span>
        )}
      </div>
    </div>
  );
}
