import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCodeTheme } from '../data/code-themes';

export type Theme = 'light' | 'dark';
export type ReadFont = 'sans' | 'serif' | 'mono';
export type Density = 'compact' | 'cozy';
export type ComposerStyle = 'panel' | 'terminal';
export type ChatWidth = 'narrow' | 'normal' | 'wide' | 'full';
export type ChatTextScale = 'sm' | 'md' | 'lg' | 'xl';

export interface Tweaks {
  theme: Theme;
  accent: string;
  readFont: ReadFont;
  density: Density;
  /** Palette preset applied while the theme is `light`. */
  lightPreset: string;
  /** Palette preset applied while the theme is `dark`. */
  darkPreset: string;
  /** Visual style of the chat composer: rounded panel (default) or
   *  terminal-like prompt with a mono font. */
  composerStyle: ComposerStyle;
  /** Width of the transcript + composer column. Drives --chat-max-width. */
  chatWidth: ChatWidth;
  /** Multiplier applied to the reading font size. Drives --read-size. */
  chatTextScale: ChatTextScale;
  /** Syntax-highlight theme for code blocks. 'default' uses the built-in
   *  accent-tracking theme; other IDs map to stock highlight.js themes. */
  codeTheme: string;
  /** Global system prompt prepended to every session's effective prompt. */
  systemPrompt: string;
  /** Height of the embedded terminal panel in px (drag-resizable). */
  terminalHeight: number;
  /** Width of the left sidebar in px (drag-resizable). */
  sidebarWidth: number;
}

interface TweaksStore extends Tweaks {
  setTheme(theme: Theme): void;
  setAccent(accent: string): void;
  setReadFont(readFont: ReadFont): void;
  setDensity(density: Density): void;
  setSystemPrompt(systemPrompt: string): void;
  setTerminalHeight(px: number): void;
  setSidebarWidth(px: number): void;
  setLightPreset(id: string): void;
  setDarkPreset(id: string): void;
  setComposerStyle(style: ComposerStyle): void;
  setChatWidth(width: ChatWidth): void;
  setChatTextScale(scale: ChatTextScale): void;
  setCodeTheme(id: string): void;
  toggleTheme(): void;
}

const DEFAULTS: Tweaks = {
  theme: 'light',
  accent: '#c4663f',
  readFont: 'sans',
  density: 'cozy',
  lightPreset: 'warm',
  darkPreset: 'classic',
  composerStyle: 'panel',
  chatWidth: 'normal',
  chatTextScale: 'md',
  codeTheme: 'default',
  systemPrompt: '',
  terminalHeight: 320,
  sidebarWidth: 268,
};

const DENSITY = {
  compact: { gap: '22px', size: 15, codeSize: 11.5, line: '1.55' },
  cozy: { gap: '32px', size: 15.5, codeSize: 12.5, line: '1.68' },
} as const;

const CHAT_WIDTH_PX: Record<ChatWidth, string> = {
  narrow: '640px',
  normal: '760px',
  wide: '960px',
  full: '100%',
};

const TEXT_SCALE: Record<ChatTextScale, number> = {
  sm: 0.9,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
};

export const useTweaks = create<TweaksStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setReadFont: (readFont) => set({ readFont }),
      setDensity: (density) => set({ density }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setLightPreset: (lightPreset) => set({ lightPreset }),
      setDarkPreset: (darkPreset) => set({ darkPreset }),
      setComposerStyle: (composerStyle) => set({ composerStyle }),
      setChatWidth: (chatWidth) => set({ chatWidth }),
      setChatTextScale: (chatTextScale) => set({ chatTextScale }),
      setCodeTheme: (codeTheme) => set({ codeTheme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'tweaks' },
  ),
);

/**
 * Side-effect hook — applies the current tweaks to `<body>` and `:root`
 * so CSS custom properties pick them up.
 */
export function useApplyTweaks(): void {
  const {
    theme,
    accent,
    readFont,
    density,
    lightPreset,
    darkPreset,
    composerStyle,
    chatWidth,
    chatTextScale,
    codeTheme,
    sidebarWidth,
  } = useTweaks();

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-density', density);
    document.body.setAttribute(
      'data-preset',
      theme === 'light' ? lightPreset : darkPreset,
    );
    document.body.setAttribute('data-composer', composerStyle);
    const r = document.documentElement.style;
    r.setProperty('--accent', accent);
    r.setProperty(
      '--read',
      readFont === 'serif'
        ? 'var(--serif)'
        : readFont === 'mono'
          ? 'var(--mono)'
          : 'var(--ui)',
    );
    const d = DENSITY[density];
    r.setProperty('--turn-gap', d.gap);
    const baseSize =
      readFont === 'serif' ? 16.5 : readFont === 'mono' ? 13.5 : d.size;
    const scaledSize = baseSize * TEXT_SCALE[chatTextScale];
    // parseFloat strips trailing zeros so "15.00" becomes "15" — keeps the
    // existing snapshot/test expectations working when scale === 1.0.
    r.setProperty('--read-size', `${parseFloat(scaledSize.toFixed(2))}px`);
    const scaledCode = d.codeSize * TEXT_SCALE[chatTextScale];
    r.setProperty('--code-size', `${parseFloat(scaledCode.toFixed(2))}px`);
    r.setProperty('--read-line', d.line);
    r.setProperty('--side-width', `${sidebarWidth}px`);
    r.setProperty('--chat-max-width', CHAT_WIDTH_PX[chatWidth]);
    applyCodeTheme(codeTheme);
  }, [
    theme,
    accent,
    readFont,
    density,
    lightPreset,
    darkPreset,
    composerStyle,
    chatWidth,
    chatTextScale,
    codeTheme,
    sidebarWidth,
  ]);
}

/** Inject (or remove) the stock highlight.js theme CSS that backs the
 *  user's chosen `codeTheme`. The 'default' sentinel removes the injected
 *  stylesheet so our built-in accent-tracking colors in transcript.css
 *  apply instead. The injected `<style>` sits at the end of <head> so its
 *  rules out-cascade any built-in `.hljs-*` declarations from our CSS. */
function applyCodeTheme(id: string): void {
  const theme = getCodeTheme(id);
  const existing = document.getElementById('hljs-theme') as HTMLStyleElement | null;
  if (!theme.css) {
    if (existing) existing.remove();
    return;
  }
  const el = existing ?? document.createElement('style');
  el.id = 'hljs-theme';
  el.textContent = theme.css;
  if (!existing) document.head.appendChild(el);
}
