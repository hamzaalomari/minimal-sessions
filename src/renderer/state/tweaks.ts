import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';
export type ReadFont = 'sans' | 'serif';
export type Density = 'compact' | 'cozy';

export interface Tweaks {
  theme: Theme;
  accent: string;
  readFont: ReadFont;
  density: Density;
}

interface TweaksStore extends Tweaks {
  setTheme(theme: Theme): void;
  setAccent(accent: string): void;
  setReadFont(readFont: ReadFont): void;
  setDensity(density: Density): void;
  toggleTheme(): void;
}

const DEFAULTS: Tweaks = {
  theme: 'light',
  accent: '#c4663f',
  readFont: 'sans',
  density: 'cozy',
};

const DENSITY = {
  compact: { gap: '22px', size: '15px', line: '1.55' },
  cozy: { gap: '32px', size: '15.5px', line: '1.68' },
} as const;

export const useTweaks = create<TweaksStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setReadFont: (readFont) => set({ readFont }),
      setDensity: (density) => set({ density }),
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
  const { theme, accent, readFont, density } = useTweaks();

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    const r = document.documentElement.style;
    r.setProperty('--accent', accent);
    r.setProperty('--read', readFont === 'serif' ? 'var(--serif)' : 'var(--ui)');
    const d = DENSITY[density];
    r.setProperty('--turn-gap', d.gap);
    r.setProperty('--read-size', readFont === 'serif' ? '16.5px' : d.size);
    r.setProperty('--read-line', d.line);
  }, [theme, accent, readFont, density]);
}
