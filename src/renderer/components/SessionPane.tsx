import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Block, Session, Turn } from '@shared/types';
import type { ChatEvent } from '@shared/api';
import { pathForTool, summaryFor, toolKindFor } from '@shared/tool-display';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { Transcript } from './Transcript';
import { useSessions } from '../state/sessions';
import { useTweaks } from '../state/tweaks';

const newTurnId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

interface SessionPaneProps {
  session: Session;
}

interface StreamingTurn {
  id: string;
  modelShort?: string;
  blocks: Block[];
  /** Trailing text accumulator — folded into blocks at turn-stop. */
  text: string;
}

export function SessionPane({ session }: SessionPaneProps) {
  const { draft, setDraft, appendTurn, setSdkSessionId } = useSessions(
    useShallow((s) => ({
      draft: s.drafts[session.id] ?? '',
      setDraft: s.setDraft,
      appendTurn: s.appendTurn,
      setSdkSessionId: s.setSdkSessionId,
    })),
  );
  const [streaming, setStreaming] = useState<StreamingTurn | null>(null);
  // The latest streaming state we can mutate from the event listener without
  // re-subscribing on every keystroke.
  const streamingRef = useRef<StreamingTurn | null>(null);
  streamingRef.current = streaming;
  // Turn ids the user stopped optimistically. The eventual real turn-stop for
  // these is consumed for sdkSessionId bookkeeping but not re-appended to the
  // transcript — we've already finalized them locally.
  const cancelledTurnIds = useRef<Set<string>>(new Set());

  // One subscription per mounted session. We filter by sessionId so other
  // active streams don't leak into this pane.
  useEffect(() => {
    if (!window.api?.chat) return;
    const unsub = window.api.chat.onEvent((sid, event) => {
      if (sid !== session.id) return;
      handleEvent(event);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const handleEvent = (event: ChatEvent): void => {
    const cur = streamingRef.current;
    if (event.type === 'turn-start') {
      const next: StreamingTurn = {
        id: event.turnId,
        modelShort: event.modelShort,
        blocks: [],
        text: '',
      };
      streamingRef.current = next;
      setStreaming(next);
      return;
    }
    // Late-arriving turn-stop after an optimistic stop has nulled cur — still
    // want the sdkSessionId update and the cancelled-id cleanup.
    if (!cur) {
      if (event.type === 'turn-stop') {
        if (event.sdkSessionId) setSdkSessionId(session.id, event.sdkSessionId);
        cancelledTurnIds.current.delete(event.turnId);
      }
      return;
    }
    if (event.type === 'text-delta') {
      const next: StreamingTurn = { ...cur, text: cur.text + event.text };
      streamingRef.current = next;
      setStreaming(next);
      return;
    }
    if (event.type === 'tool-start') {
      // We don't have the result yet; show a placeholder win with the correct
      // kind, real path/command, and Claude's description as the summary.
      // turn-stop will replace it with the canonical block.
      const kind = toolKindFor(event.name);
      const path = pathForTool(event.name, event.input);
      const summary = summaryFor(event.name, event.input);
      const newWin: Block = {
        type: 'win',
        kind,
        path,
        ...(summary ? { summary } : {}),
        ...(kind === 'bash' ? { defaultOpen: false } : {}),
      };
      // Coalesce same-kind back-to-back tool calls (matches main-process behavior).
      const folded = foldText(cur);
      const last = folded[folded.length - 1];
      let nextBlocks: Block[];
      if (kind !== 'bash' && last && last.type === 'win' && last.kind === kind) {
        const existingPaths = last.paths ?? [last.path];
        nextBlocks = [
          ...folded.slice(0, -1),
          { ...last, paths: [...existingPaths, path] },
        ];
      } else {
        nextBlocks = [...folded, newWin];
      }
      const next: StreamingTurn = {
        ...cur,
        blocks: nextBlocks,
        text: '',
      };
      streamingRef.current = next;
      setStreaming(next);
      return;
    }
    if (event.type === 'turn-stop') {
      // sdkSessionId update applies even when the user already stopped — the
      // SDK still hands us back a session id for resume context.
      if (event.sdkSessionId) setSdkSessionId(session.id, event.sdkSessionId);
      if (cancelledTurnIds.current.has(event.turnId)) {
        cancelledTurnIds.current.delete(event.turnId);
        return;
      }
      const finalTurn: Turn = {
        id: event.turnId,
        role: 'assistant',
        blocks: event.blocks,
        createdAt: Date.now(),
        ...(cur.modelShort ? { modelShort: cur.modelShort } : {}),
      };
      streamingRef.current = null;
      setStreaming(null);
      appendTurn(session.id, finalTurn, event.addTokens, event.addUsage);
      return;
    }
    if (event.type === 'error') {
      // We let the final 'turn-stop' carry the error block too, but this is
      // a useful signal for any future UI surface (e.g. a toast).
      return;
    }
  };

  /**
   * Instant-stop UX: finalize the in-flight assistant turn locally with whatever
   * partial content has streamed in plus a "Stopped." marker, then fire the
   * abort to main. The eventual real turn-stop is just consumed for sdkSessionId.
   */
  const stop = (): void => {
    const cur = streamingRef.current;
    if (cur) {
      const partial: Turn = {
        id: cur.id,
        role: 'assistant',
        blocks: [...foldText(cur), { type: 'p', text: 'Stopped.' }],
        createdAt: Date.now(),
        ...(cur.modelShort ? { modelShort: cur.modelShort } : {}),
      };
      cancelledTurnIds.current.add(cur.id);
      streamingRef.current = null;
      setStreaming(null);
      appendTurn(session.id, partial, 0);
    }
    void window.api.chat.stop(session.id);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || streaming) return;

    const userTurn: Turn = {
      id: newTurnId(),
      role: 'user',
      blocks: [{ type: 'p', text }],
      createdAt: Date.now(),
    };
    appendTurn(session.id, userTurn);
    setDraft(session.id, '');

    try {
      const globalSystemPrompt = useTweaks.getState().systemPrompt;
      await window.api.chat.send(session.id, text, globalSystemPrompt);
    } catch (e) {
      const message = (e as Error)?.message || 'Failed to send.';
      // Render the error as an assistant turn so the user sees it inline.
      appendTurn(session.id, {
        id: newTurnId(),
        role: 'assistant',
        blocks: [{ type: 'error', message }],
        createdAt: Date.now(),
      });
      streamingRef.current = null;
      setStreaming(null);
    }
  };

  // Build the rendered turn list = persisted + live streaming overlay.
  const displaySession: Session = streaming
    ? {
        ...session,
        turns: [
          ...session.turns,
          {
            id: streaming.id,
            role: 'assistant' as const,
            blocks: foldText(streaming),
            createdAt: Date.now(),
            ...(streaming.modelShort ? { modelShort: streaming.modelShort } : {}),
          },
        ],
      }
    : session;

  return (
    <>
      {displaySession.turns.length === 0 ? (
        <EmptyState
          session={session}
          onSuggest={(t) => setDraft(session.id, t)}
        />
      ) : (
        <Transcript session={displaySession} typing={!!streaming} />
      )}
      <Composer
        key={session.id}
        session={session}
        value={draft}
        onChange={(t) => setDraft(session.id, t)}
        onSend={send}
        onStop={stop}
        busy={!!streaming}
      />
    </>
  );
}

function foldText(s: StreamingTurn): Block[] {
  if (!s.text) return s.blocks;
  return [...s.blocks, { type: 'p', text: s.text }];
}
