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

  // While streaming, fold the dots into the last assistant turn instead of
  // showing a second "Claude" header below the in-flight content. Fallback
  // (no turns yet, or last turn is the user's) renders the standalone header.
  const lastIdx = session.turns.length - 1;
  const lastIsAssistant =
    lastIdx >= 0 && session.turns[lastIdx]!.role === 'assistant';
  const trailingTyping = typing && lastIsAssistant;
  const standaloneTyping = typing && !lastIsAssistant;

  return (
    <div className="transcript scroll" ref={ref} data-testid="transcript">
      <div className="transcript-inner">
        <SessionHead session={session} />
        {session.turns.map((t, i) => (
          <Turn key={t.id} turn={t} typing={trailingTyping && i === lastIdx} />
        ))}
        {standaloneTyping && (
          <div className="turn assistant">
            <div className="turn-role">
              <span className="role-badge asst">
                <Icon name="spark" />
              </span>
              <span className="role-name">Claude</span>
            </div>
            <div className="turn-body">
              <div className="typing-dots" data-testid="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
