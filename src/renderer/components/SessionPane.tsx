import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, Turn } from '@shared/types';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { Transcript } from './Transcript';
import { nextReply } from '../data/canned';
import { getModel } from '../data/models';
import { useSessions } from '../state/sessions';

const REPLY_DELAY_MS = 700;

const newTurnId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface SessionPaneProps {
  session: Session;
}

export function SessionPane({ session }: SessionPaneProps) {
  const { draft, typing, setDraft, setTyping, appendTurn } = useSessions(
    useShallow((s) => ({
      draft: s.drafts[session.id] ?? '',
      typing: s.typing,
      setDraft: s.setDraft,
      setTyping: s.setTyping,
      appendTurn: s.appendTurn,
    })),
  );

  // Cancel any pending canned reply if we unmount or switch sessions.
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  const send = () => {
    const text = draft.trim();
    if (!text || typing) return;

    const userTurn: Turn = {
      id: newTurnId(),
      role: 'user',
      blocks: [{ type: 'p', text }],
      createdAt: Date.now(),
    };
    appendTurn(session.id, userTurn);
    setDraft(session.id, '');
    setTyping(true);

    const sessionId = session.id;
    const modelShort = getModel(session.model)?.short;
    replyTimer.current = setTimeout(() => {
      const reply: Turn = {
        id: newTurnId(),
        role: 'assistant',
        blocks: nextReply(),
        modelShort,
        createdAt: Date.now(),
      };
      appendTurn(sessionId, reply);
      setTyping(false);
      replyTimer.current = null;
    }, REPLY_DELAY_MS);
  };

  return (
    <>
      {session.turns.length === 0 ? (
        <EmptyState
          session={session}
          onSuggest={(t) => setDraft(session.id, t)}
        />
      ) : (
        <Transcript session={session} typing={typing} />
      )}
      <Composer
        key={session.id}
        session={session}
        value={draft}
        onChange={(t) => setDraft(session.id, t)}
        onSend={send}
        busy={typing}
      />
    </>
  );
}
