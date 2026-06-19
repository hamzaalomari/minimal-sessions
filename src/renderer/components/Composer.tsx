import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { SlashSuggestions } from './SlashSuggestions';
import { getModel } from '../data/models';

interface ComposerProps {
  session: Session;
  value: string;
  onChange(text: string): void;
  /** Called with the final expanded text — placeholders for large pastes are
   *  resolved back to their original content here, so the caller can keep
   *  treating the draft string as the source of truth for display. */
  onSend(text: string): void;
  /** Optional — when provided, the send button becomes a stop button while busy. */
  onStop?(): void;
  busy?: boolean;
}

/** Handle the parent can hold to programmatically focus the composer's textarea
 *  (used by SessionPane to route stray keystrokes into the composer when the
 *  user has clicked inside the pane but not on the composer itself). */
export interface ComposerHandle {
  focus(): void;
  /** Direct access to the underlying textarea — parents use this to insert
   *  characters and position the caret programmatically. */
  getTextarea(): HTMLTextAreaElement | null;
}

/** Lines (or characters) above which a paste is collapsed into a placeholder
 *  chip in the textarea instead of being inlined. */
const PASTE_LINE_THRESHOLD = 15;
const PASTE_CHAR_THRESHOLD = 1500;
/** Textarea ceiling before vertical scroll kicks in. */
const COMPOSER_MAX_PX = 400;

/** Placeholder pattern matches anything we wrote: `[Pasted #<id>: <n> lines]`. */
const PASTE_PLACEHOLDER_RE = /\[Pasted #(\d+): \d+ lines?\]/g;

function countLines(s: string): number {
  if (!s) return 0;
  return s.split('\n').length;
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { session, value, onChange, onSend, onStop, busy = false },
  ref,
) {
  const [focus, setFocus] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
    getTextarea: () => taRef.current,
  }));
  /** Stash of full text per placeholder id. Cleared whenever the draft is
   *  emptied by the parent (e.g. after a successful send). */
  const chunksRef = useRef<Map<number, string>>(new Map());
  const nextChunkIdRef = useRef(1);
  const m = getModel(session.model);
  const dot = m?.color ?? 'var(--faint)';
  const short = m?.short ?? session.model;

  // Drop any stashed paste chunks when the parent clears the draft — keeps
  // chunk ids from leaking across sends.
  useEffect(() => {
    if (value === '') {
      chunksRef.current.clear();
      nextChunkIdRef.current = 1;
    }
  }, [value]);

  // Auto-grow up to the ceiling. Past the ceiling, the textarea becomes
  // scrollable — the CSS in composer.css thins the scrollbar to a subtle
  // track so it doesn't dominate the box.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(COMPOSER_MAX_PX, ta.scrollHeight) + 'px';
  }, [value]);

  const trimmed = value.trim();
  const isSkill = trimmed.startsWith('/');
  const canSend = trimmed.length > 0 && !busy;

  /** Walk through the display text and swap each `[Pasted #N: K lines]`
   *  placeholder for the original chunk we stashed away. */
  const expand = (text: string): string => {
    return text.replace(PASTE_PLACEHOLDER_RE, (match, idStr: string) => {
      const id = Number(idStr);
      return chunksRef.current.get(id) ?? match;
    });
  };

  const submit = (): void => {
    if (!canSend) return;
    onSend(expand(value));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === 'Escape' && busy && onStop) {
      e.preventDefault();
      onStop();
    }
  };

  /** Intercept large pastes and replace them with a `[Pasted #N: K lines]`
   *  placeholder. Small pastes fall through to the textarea's native handler
   *  so caret placement and undo history Just Work. */
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>): void => {
    const pasted = e.clipboardData.getData('text/plain');
    const lines = countLines(pasted);
    if (lines < PASTE_LINE_THRESHOLD && pasted.length < PASTE_CHAR_THRESHOLD) {
      return;
    }
    e.preventDefault();
    const id = nextChunkIdRef.current++;
    chunksRef.current.set(id, pasted);
    const placeholder = `[Pasted #${id}: ${lines} line${lines === 1 ? '' : 's'}]`;
    const ta = e.currentTarget;
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + placeholder + value.slice(end);
    onChange(next);
    // Move the caret past the inserted placeholder once React re-renders.
    queueMicrotask(() => {
      if (!taRef.current) return;
      const pos = start + placeholder.length;
      taRef.current.setSelectionRange(pos, pos);
    });
  };

  const folderName = session.path.split('/').pop() || session.path;

  /** Quote a path with double-quotes if it contains a space or shell metachar,
   *  so Claude can parse the message unambiguously. */
  const quoteIfNeeded = (p: string): string =>
    /[\s"'`$&|;()<>*?[\]{}\\]/.test(p) ? `"${p.replace(/"/g, '\\"')}"` : p;

  const attach = async (): Promise<void> => {
    const picker = window.api?.fs?.pickFiles;
    if (!picker) return;
    let paths: string[];
    try {
      paths = await picker(session.path);
    } catch {
      return;
    }
    if (paths.length === 0) return;
    const insert = paths.map(quoteIfNeeded).join(' ');
    const ta = taRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    const needsLeadingSpace = start > 0 && !/\s$/.test(value.slice(0, start));
    const needsTrailingSpace = end < value.length && !/^\s/.test(value.slice(end));
    const chunk =
      (needsLeadingSpace ? ' ' : '') + insert + (needsTrailingSpace ? ' ' : '');
    const next = value.slice(0, start) + chunk + value.slice(end);
    onChange(next);
    queueMicrotask(() => {
      if (!taRef.current) return;
      const pos = start + chunk.length;
      taRef.current.focus();
      taRef.current.setSelectionRange(pos, pos);
    });
  };

  const pickSuggestion = (text: string): void => {
    // Replace the slash-prefix segment (everything up to the first space) with
    // the picked command name. Preserves any trailing args the user already
    // typed beyond the prefix.
    const rest = value.slice(1);
    const sp = rest.indexOf(' ');
    const trailing = sp === -1 ? '' : rest.slice(sp + 1);
    onChange(text + trailing);
    queueMicrotask(() => taRef.current?.focus());
  };

  return (
    <div className="composer">
      <div className="composer-inner">
        <div
          className={
            'composer-box' + (focus ? ' focus' : '') + (isSkill ? ' skill-mode' : '')
          }
        >
          {isSkill && (
            <div className="composer-mode" data-testid="skill-mode-chip">
              <Icon name="terminal" />
              <span>Slash command</span>
            </div>
          )}
          {isSkill && (
            <SlashSuggestions
              cwd={session.path}
              value={value}
              onPick={pickSuggestion}
            />
          )}
          <textarea
            ref={taRef}
            className="composer-ta"
            rows={1}
            aria-label="Message Claude"
            placeholder={
              isSkill
                ? 'Type /command args, then Enter'
                : `Message Claude about ${folderName}… (type / for slash commands)`
            }
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          <div className="composer-foot">
            <button
              type="button"
              className="cf-btn"
              title="Attach file(s)"
              aria-label="Attach files"
              onClick={attach}
            >
              <Icon name="paperclip" />
            </button>
            <button type="button" className="cf-btn cf-model" title="Model for this session">
              <span className="cf-mdot" style={{ background: dot }} />
              {short}
            </button>
            <div className="cf-spacer" />
            <span className="cf-hint">
              {busy && onStop
                ? 'Esc or click stop to cancel'
                : isSkill
                  ? '↵ to run · slash commands supported'
                  : '↵ to send · ⇧↵ newline · / for commands'}
            </span>
            {busy && onStop ? (
              <button
                type="button"
                className="send-btn stop-btn"
                onClick={onStop}
                title="Stop"
                aria-label="Stop generating"
                data-testid="stop-btn"
              >
                <Icon name="stop" />
              </button>
            ) : (
              <button
                type="button"
                className="send-btn"
                disabled={!canSend}
                onClick={submit}
                title="Send"
                aria-label="Send message"
              >
                <Icon name="send" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
