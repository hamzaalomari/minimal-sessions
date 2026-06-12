import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Block, Session, Turn } from '@shared/types';
import type { ChatEvent } from '@shared/api';
import { pathForTool, summaryFor, toolKindFor } from '@shared/tool-display';
import { Composer, type ComposerHandle } from './Composer';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { Terminal } from './Terminal';
import { Transcript } from './Transcript';
import { formatShortcut } from '../lib/platform';
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
  const {
    draft,
    setDraft,
    appendTurn,
    setSdkSessionId,
    setStreaming,
    terminalOpen,
    toggleTerminalOpen,
  } = useSessions(
    useShallow((s) => ({
      draft: s.drafts[session.id] ?? '',
      setDraft: s.setDraft,
      appendTurn: s.appendTurn,
      setSdkSessionId: s.setSdkSessionId,
      setStreaming: s.setStreaming,
      terminalOpen: s.terminalOpenIds.includes(session.id),
      toggleTerminalOpen: s.toggleTerminalOpen,
    })),
  );
  const terminalHeight = useTweaks((s) => s.terminalHeight);
  const setTerminalHeight = useTweaks((s) => s.setTerminalHeight);
  const splitRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<ComposerHandle | null>(null);
  /** Wraps everything SessionPane renders. We compare against this on document
   *  mousedown to decide whether subsequent typing should land in the composer. */
  const paneRootRef = useRef<HTMLDivElement | null>(null);
  /** Set to true on a mousedown inside the pane; reset to false on a mousedown
   *  anywhere else. While true, printable-key presses with no other input
   *  focused get routed into the composer's textarea. */
  const armedRef = useRef(false);
  const [streaming, setStreamingLocal] = useState<StreamingTurn | null>(null);
  /** Bumped every time the user sends. Drives Transcript's force-scroll-to-bottom
   *  so the user always sees their new message + streaming reply, even if they
   *  were scrolled up reading earlier history. */
  const [pinNonce, setPinNonce] = useState(0);
  // The latest streaming state we can mutate from the event listener without
  // re-subscribing on every keystroke.
  const streamingRef = useRef<StreamingTurn | null>(null);
  streamingRef.current = streaming;
  // Turn ids the user stopped optimistically. The eventual real turn-stop for
  // these is consumed for sdkSessionId bookkeeping but not re-appended to the
  // transcript — we've already finalized them locally.
  const cancelledTurnIds = useRef<Set<string>>(new Set());

  // Arm/disarm typing-into-composer based on where the user mousedowns. We
  // listen at document level so we catch clicks anywhere (sidebar, statusbar,
  // titlebar) and disarm accordingly. The pane root is wrapped in a
  // display:contents div so we can match descendant clicks with `.contains()`.
  useEffect(() => {
    function onDocMouseDown(e: globalThis.MouseEvent): void {
      const target = e.target as Node | null;
      const root = paneRootRef.current;
      armedRef.current = !!(root && target && root.contains(target));
    }
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, []);

  // Document-level keydown — when armed AND nothing else has text focus, route
  // printable keys into the composer's textarea. Closes over terminalOpen so it
  // re-binds when the user switches sub-tabs.
  useEffect(() => {
    function onDocKeyDown(e: globalThis.KeyboardEvent): void {
      if (!armedRef.current || terminalOpen) return;
      // Skip if the user is already typing somewhere else.
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          active.isContentEditable
        ) {
          return;
        }
      }
      // Let chord shortcuts fall through (Cmd+K, Ctrl+F, etc.).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const ta = composerRef.current?.getTextarea();
      if (!ta) return;

      if (e.key.length === 1) {
        e.preventDefault();
        ta.focus();
        appendToControlledTextarea(ta, e.key);
      } else if (e.key === 'Backspace') {
        if (!ta.value) return;
        e.preventDefault();
        ta.focus();
        setControlledTextareaValue(ta, ta.value.slice(0, -1));
      }
    }
    document.addEventListener('keydown', onDocKeyDown);
    return () => document.removeEventListener('keydown', onDocKeyDown);
  }, [terminalOpen]);

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
      setStreamingLocal(next);
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
      setStreamingLocal(next);
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
      setStreamingLocal(next);
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
      setStreamingLocal(null);
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
      setStreamingLocal(null);
      appendTurn(session.id, partial, 0);
    }
    setStreaming(session.id, false);
    void window.api.chat.stop(session.id);
  };

  const send = async (rawText: string = draft) => {
    const text = rawText.trim();
    if (!text || streaming) return;

    const userTurn: Turn = {
      id: newTurnId(),
      role: 'user',
      blocks: [{ type: 'p', text }],
      createdAt: Date.now(),
    };
    appendTurn(session.id, userTurn);
    setDraft(session.id, '');
    // Snap the transcript to the bottom — the user just hit Send, so they
    // expect to see the new turn and the streaming reply that follows it.
    setPinNonce((n) => n + 1);
    // Flip the sidebar status dot to "busy" right away — turn-start may be
    // milliseconds away but feedback should be immediate.
    setStreaming(session.id, true);

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
      setStreaming(session.id, false);
      setStreamingLocal(null);
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
    <div ref={paneRootRef} style={{ display: 'contents' }}>
      <div className="pane-tabs" role="tablist" aria-label="Session view">
        <button
          type="button"
          role="tab"
          aria-selected={!terminalOpen}
          className={'pane-tab' + (!terminalOpen ? ' on' : '')}
          onClick={() => {
            if (terminalOpen) toggleTerminalOpen(session.id);
          }}
        >
          <Icon name="sessions" />
          <span>Chat</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={terminalOpen}
          className={'pane-tab' + (terminalOpen ? ' on' : '')}
          onClick={() => {
            if (!terminalOpen) toggleTerminalOpen(session.id);
          }}
          title={`Terminal (${formatShortcut('J')})`}
        >
          <Icon name="terminal" />
          <span>Terminal</span>
        </button>
      </div>
      {/* Transcript is rendered in the same JSX position in both states so
       *  React keeps the instance and its scroll position is preserved when
       *  toggling between Chat and Terminal sub-tabs. */}
      <div className="term-split" ref={splitRef}>
        {displaySession.turns.length === 0 ? (
          <EmptyState
            session={session}
            onSuggest={(t) => setDraft(session.id, t)}
          />
        ) : (
          <Transcript
            session={displaySession}
            typing={!!streaming}
            pinToBottomNonce={pinNonce}
          />
        )}
        {terminalOpen && (
          <>
            <div
              role="separator"
              aria-label="Resize terminal"
              aria-orientation="horizontal"
              className="term-resize"
              onMouseDown={onResizeStart}
            />
            <div className="term-wrap" style={{ height: terminalHeight }}>
              <Terminal
                session={session}
                onClose={() => toggleTerminalOpen(session.id)}
              />
            </div>
          </>
        )}
      </div>
      {!terminalOpen && (
        <Composer
          ref={composerRef}
          key={session.id}
          session={session}
          value={draft}
          onChange={(t) => setDraft(session.id, t)}
          onSend={send}
          onStop={stop}
          busy={!!streaming}
        />
      )}
    </div>
  );

  function onResizeStart(e: ReactMouseEvent<HTMLDivElement>): void {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;
    const prevCursor = document.body.style.cursor;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const move = (ev: globalThis.MouseEvent): void => {
      const containerH = splitRef.current?.getBoundingClientRect().height ?? 600;
      // Dragging up grows the terminal; dragging down shrinks it.
      const next = Math.max(
        140,
        Math.min(containerH - 140, startHeight + (startY - ev.clientY)),
      );
      setTerminalHeight(next);
    };
    const end = (): void => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }
}

function foldText(s: StreamingTurn): Block[] {
  if (!s.text) return s.blocks;
  return [...s.blocks, { type: 'p', text: s.text }];
}

/**
 * Programmatically set the value of a React-controlled textarea so the
 * change is observed by React's onChange handler. React installs its own
 * `value` setter on the element; we have to call the *native* setter and
 * then dispatch an input event so React's synthetic event fires.
 */
function setControlledTextareaValue(ta: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  setter?.call(ta, value);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.setSelectionRange(value.length, value.length);
}

function appendToControlledTextarea(ta: HTMLTextAreaElement, text: string): void {
  setControlledTextareaValue(ta, ta.value + text);
}
