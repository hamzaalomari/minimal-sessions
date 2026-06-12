import { useEffect, useMemo, useRef, useState } from 'react';
import type { SlashCommand } from '@shared/api';
import { Icon } from './Icon';

interface SlashSuggestionsProps {
  /** Working directory of the active session — used to discover plugin /
   *  project commands. */
  cwd: string;
  /** Current draft text. The popover hides itself when this doesn't start with `/`. */
  value: string;
  /** Called when the user picks a command (click or Enter). Receives the full
   *  command text the parent should insert ("/cmdname " with trailing space). */
  onPick(commandText: string): void;
}

/** Rendered above the composer-box; absolutely positioned by .slash-suggest. */
export function SlashSuggestions({ cwd, value, onPick }: SlashSuggestionsProps) {
  const [all, setAll] = useState<SlashCommand[]>([]);
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Fetch the command list once per cwd. Main-process caches behind this, so
  // a quick re-fetch on cwd change is fine.
  useEffect(() => {
    let alive = true;
    if (!cwd || !window.api?.commands) return;
    window.api.commands
      .list(cwd)
      .then((cmds) => {
        if (alive) setAll(cmds);
      })
      .catch(() => {
        if (alive) setAll([]);
      });
    return () => {
      alive = false;
    };
  }, [cwd]);

  // The query is whatever the user has typed after "/" up to the first space
  // (so "/foo bar" matches commands starting with "foo").
  const query = useMemo(() => {
    if (!value.startsWith('/')) return null;
    const rest = value.slice(1);
    const sp = rest.indexOf(' ');
    return sp === -1 ? rest : rest.slice(0, sp);
  }, [value]);

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return all
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [all, query]);

  // Reset highlight when the filtered set changes — otherwise the index can
  // point past the new shorter list and key-down would feel broken.
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Keep the highlighted row in view when navigating with arrow keys.
  useEffect(() => {
    const row = listRef.current?.children[highlight] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  // Bind arrow / Enter / Esc at the window level *while open*. The Composer
  // owns the textarea so this is the simplest way to intercept those keys
  // before the textarea's own onKeyDown sees them.
  useEffect(() => {
    if (matches.length === 0) return;
    function onKey(e: globalThis.KeyboardEvent): void {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(matches.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        const pick = matches[highlight];
        if (!pick) return;
        e.preventDefault();
        e.stopPropagation();
        onPick(`/${pick.name} `);
      } else if (e.key === 'Escape') {
        // Caller can clear the prefix; we just consume the key so it doesn't
        // bubble up to other Esc handlers (like the in-flight stop).
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [matches, highlight, onPick]);

  if (query === null || matches.length === 0) return null;

  return (
    <div className="slash-suggest" role="listbox" aria-label="Slash command suggestions">
      <div className="slash-head">
        <Icon name="terminal" />
        <span>Slash commands</span>
        <span className="slash-help">↑↓ to navigate · ↵/Tab to insert</span>
      </div>
      <div className="slash-list" ref={listRef}>
        {matches.map((cmd, i) => (
          <button
            key={cmd.name}
            type="button"
            role="option"
            aria-selected={i === highlight}
            className={'slash-row' + (i === highlight ? ' on' : '')}
            onMouseEnter={() => setHighlight(i)}
            onClick={() => onPick(`/${cmd.name} `)}
          >
            <span className="slash-name">/{cmd.name}</span>
            {cmd.description && (
              <span className="slash-desc">{cmd.description}</span>
            )}
            <span className={'slash-scope scope-' + cmd.scope}>{cmd.scope}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
