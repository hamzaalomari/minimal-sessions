/** Code-block syntax highlighting themes. Each entry pairs a label with the
 *  raw stylesheet text from highlight.js's stock themes — Vite's `?raw`
 *  loader resolves them at build time so we get the CSS as a string we can
 *  inject into a single `<style>` element on demand.
 *
 *  The `'default'` entry isn't really a theme — it's the sentinel that tells
 *  useApplyTweaks to fall back to our hand-rolled accent-tracking colors in
 *  transcript.css instead of injecting any external CSS. */

import githubLightCSS from 'highlight.js/styles/github.css?raw';
import githubDarkCSS from 'highlight.js/styles/github-dark.css?raw';
import atomOneLightCSS from 'highlight.js/styles/atom-one-light.css?raw';
import atomOneDarkCSS from 'highlight.js/styles/atom-one-dark.css?raw';
import vsCSS from 'highlight.js/styles/vs.css?raw';
import vs2015CSS from 'highlight.js/styles/vs2015.css?raw';
import tokyoNightLightCSS from 'highlight.js/styles/tokyo-night-light.css?raw';
import tokyoNightDarkCSS from 'highlight.js/styles/tokyo-night-dark.css?raw';
import monokaiCSS from 'highlight.js/styles/monokai.css?raw';
import nordCSS from 'highlight.js/styles/nord.css?raw';

export interface CodeTheme {
  id: string;
  label: string;
  mood: 'light' | 'dark' | 'both';
  /** Raw CSS text from highlight.js, or null for the in-tree default. */
  css: string | null;
}

export const CODE_THEMES: CodeTheme[] = [
  {
    id: 'default',
    label: 'Accent (built-in)',
    mood: 'both',
    css: null,
  },
  { id: 'github', label: 'GitHub Light', mood: 'light', css: githubLightCSS },
  { id: 'github-dark', label: 'GitHub Dark', mood: 'dark', css: githubDarkCSS },
  {
    id: 'atom-one-light',
    label: 'Atom One Light',
    mood: 'light',
    css: atomOneLightCSS,
  },
  {
    id: 'atom-one-dark',
    label: 'Atom One Dark',
    mood: 'dark',
    css: atomOneDarkCSS,
  },
  { id: 'vs', label: 'Visual Studio', mood: 'light', css: vsCSS },
  { id: 'vs2015', label: 'VS 2015 Dark', mood: 'dark', css: vs2015CSS },
  {
    id: 'tokyo-night-light',
    label: 'Tokyo Night Light',
    mood: 'light',
    css: tokyoNightLightCSS,
  },
  {
    id: 'tokyo-night-dark',
    label: 'Tokyo Night',
    mood: 'dark',
    css: tokyoNightDarkCSS,
  },
  { id: 'monokai', label: 'Monokai', mood: 'dark', css: monokaiCSS },
  { id: 'nord', label: 'Nord', mood: 'both', css: nordCSS },
];

export function getCodeTheme(id: string): CodeTheme {
  return CODE_THEMES.find((t) => t.id === id) ?? CODE_THEMES[0]!;
}
