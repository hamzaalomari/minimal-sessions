/** Curated accent palettes that read well over both light and dark themes.
 *  The hex value is what gets stored in tweaks.accent and pushed to the
 *  `--accent` CSS custom property; the rest of the system mixes it into
 *  panels, borders, and active states automatically. */

export interface AccentPreset {
  id: string;
  label: string;
  hex: string;
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'terracotta', label: 'Terracotta', hex: '#c4663f' },
  { id: 'ocean', label: 'Ocean', hex: '#3c7eb8' },
  { id: 'forest', label: 'Forest', hex: '#5b9a78' },
  { id: 'plum', label: 'Plum', hex: '#9a6bb4' },
  { id: 'rose', label: 'Rose', hex: '#c46380' },
  { id: 'amber', label: 'Amber', hex: '#c98e3c' },
  { id: 'slate', label: 'Slate', hex: '#6b7a8f' },
  { id: 'teal', label: 'Teal', hex: '#3f9a9a' },
];
