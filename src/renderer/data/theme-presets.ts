/** Palette presets — each one swaps a slice of the base theme via the
 *  `data-preset` attribute on <body>. The CSS for each lives in tokens.css
 *  next to the base theme definitions. The `preview` hex is just the
 *  swatch shown in the picker; the actual rendering is driven by the CSS
 *  variable cascade. */

export interface ThemePreset {
  id: string;
  label: string;
  /** Hex sample shown in the picker — usually the preset's canvas color. */
  preview: string;
}

export const LIGHT_PRESETS: ThemePreset[] = [
  { id: 'warm', label: 'Warm', preview: '#fbf6ee' },
  { id: 'paper', label: 'Paper', preview: '#ffffff' },
  { id: 'mist', label: 'Mist', preview: '#eef1f5' },
];

export const DARK_PRESETS: ThemePreset[] = [
  { id: 'classic', label: 'Classic', preview: '#2a2620' },
  { id: 'midnight', label: 'Midnight', preview: '#1a1a1a' },
  { id: 'ocean', label: 'Ocean', preview: '#1f2b3d' },
  { id: 'slate', label: 'Slate', preview: '#262b33' },
];
