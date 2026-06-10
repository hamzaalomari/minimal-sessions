import { useEffect, useRef } from 'react';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { SessionHead } from './SessionHead';
import { Turn } from './Turn';

interface TranscriptProps {
  session: Session;
  typing?: boolean;
}

export function Transcript({ session, typing = false }: TranscriptProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.id, session.turns.length, typing]);

  return (
    <div className="transcript scroll" ref={ref} data-testid="transcript">
      <div className="transcript-inner">
        <SessionHead session={session} />
        {session.turns.map((t) => (
          <Turn key={t.id} turn={t} />
        ))}
        {typing && (
          <div className="turn assistant" data-testid="typing">
            <div className="turn-role">
              <span className="role-badge asst">
                <Icon name="spark" />
              </span>
              <span className="role-name">Claude</span>
            </div>
            <div className="typing-dots">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
