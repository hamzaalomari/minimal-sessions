import { useEffect, useRef } from 'react';
import { Terminal as Xterm, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { Session } from '@shared/types';
import { Icon } from './Icon';
import { useSessions } from '../state/sessions';
import { useTweaks } from '../state/tweaks';

interface TerminalProps {
  session: Session;
  onClose(): void;
}

function readVar(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function buildTheme(): ITheme {
  const text = readVar('--text');
  const bg = readVar('--panel');
  const accent = readVar('--accent');
  const faint = readVar('--faint');
  return {
    background: bg || '#1a1a1a',
    foreground: text || '#e8e4dc',
    cursor: accent || '#c4663f',
    cursorAccent: bg || '#1a1a1a',
    selectionBackground: accent
      ? `color-mix(in oklch, ${accent} 35%, transparent)`
      : 'rgba(196,102,63,0.35)',
    black: '#1a1a1a',
    brightBlack: faint || '#666',
    red: '#e06c75',
    brightRed: '#e06c75',
    green: '#98c379',
    brightGreen: '#98c379',
    yellow: '#e5c07b',
    brightYellow: '#e5c07b',
    blue: '#61afef',
    brightBlue: '#61afef',
    magenta: '#c678dd',
    brightMagenta: '#c678dd',
    cyan: '#56b6c2',
    brightCyan: '#56b6c2',
    white: text || '#e8e4dc',
    brightWhite: text || '#ffffff',
  };
}

export function Terminal({ session, onClose }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Xterm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const theme = useTweaks((s) => s.theme);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const term = new Xterm({
      fontFamily:
        "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
      theme: buildTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    xtermRef.current = term;
    fitRef.current = fit;

    const offData = window.api.terminal.onData((sid, data) => {
      if (sid !== session.id) return;
      term.write(data);
    });
    const offExit = window.api.terminal.onExit((sid) => {
      if (sid !== session.id) return;
      term.writeln('\r\n\x1b[2m[process exited — closing terminal]\x1b[0m');
      // Give the user a beat to see it, then close.
      setTimeout(onClose, 400);
    });

    const inputSub = term.onData((data) => {
      void window.api.terminal.write(session.id, data);
    });

    void window.api.terminal
      .open(session.id, session.path, term.cols, term.rows)
      .then(() => {
        term.focus();
        // If something queued one or more writes to run on open (e.g.
        // "Sign in to Claude" → start claude, wait, send `/login`), run
        // the sequence now. Each step's delay accumulates so step N fires
        // sum(delay_1..N) ms after PTY open.
        const steps = useSessions
          .getState()
          .consumePendingTerminalCommand(session.id);
        if (steps && steps.length > 0) {
          let cumulative = 0;
          for (const step of steps) {
            cumulative += step.delayMs ?? 250;
            setTimeout(() => {
              void window.api.terminal.write(session.id, step.text);
            }, cumulative);
          }
        }
      })
      .catch((e) => {
        term.writeln(`\x1b[31m[failed to open shell: ${(e as Error).message}]\x1b[0m`);
      });

    const ro = new ResizeObserver(() => {
      if (!fitRef.current || !xtermRef.current) return;
      try {
        fitRef.current.fit();
        void window.api.terminal.resize(
          session.id,
          xtermRef.current.cols,
          xtermRef.current.rows,
        );
      } catch {
        // ResizeObserver can fire during teardown — ignore.
      }
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      inputSub.dispose();
      offData();
      offExit();
      term.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Re-theme on light/dark switch without tearing down the PTY.
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = buildTheme();
    }
  }, [theme]);

  return (
    <div className="term-panel" data-testid="terminal-panel">
      <div className="term-bar">
        <span className="term-title">
          <Icon name="folder" />
          <span>{session.path}</span>
        </span>
      </div>
      <div ref={hostRef} className="term-host" />
    </div>
  );
}
