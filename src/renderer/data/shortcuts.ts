/**
 * Catalogue of every keyboard shortcut the app binds, grouped by category.
 * Source of truth for the in-app cheatsheet overlay.
 *
 * Keys are written in mac form (⌘, ⇧, ⌥, ⌃) and converted to
 * Ctrl+/Shift+/Alt+/Win+ when rendered on Windows / Linux.
 *
 * If you add a new global accelerator in `src/main/index.ts`, add a row
 * here too — the overlay is the user-facing source of truth.
 */

export interface ShortcutEntry {
  /** Human description shown in the second column. */
  label: string;
  /** Canonical key combo in mac form, e.g. "⌘N", "⇧⌘W", "⌘1..9". The
   *  renderer rewrites Cmd→Ctrl on non-mac and ⇧→Shift+ etc. for display. */
  combo: string;
}

export interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Sessions & tabs',
    entries: [
      { label: 'New session', combo: '⌘N' },
      { label: 'Close active tab', combo: '⌘W' },
      { label: 'Close window', combo: '⇧⌘W' },
      { label: 'Jump to tab N', combo: '⌘1..9' },
      { label: 'Next tab', combo: 'Ctrl+Tab' },
      { label: 'Previous tab', combo: '⌃⇧Tab' },
      { label: 'Cycle next tab (alt)', combo: '⌘~' },
      { label: 'Cycle next tab (alt)', combo: '⌘⇧]' },
      { label: 'Cycle previous tab (alt)', combo: '⌘⇧[' },
    ],
  },
  {
    title: 'View & navigation',
    entries: [
      { label: 'Toggle sidebar', combo: '⌘B' },
      { label: 'Open preferences', combo: '⌘,' },
      { label: 'Find session', combo: '⌘F' },
      { label: 'Toggle embedded terminal', combo: '⌘J' },
      { label: 'Navigate back', combo: '⌘⌥←' },
      { label: 'Navigate forward', combo: '⌘⌥→' },
      { label: 'Show this cheatsheet', combo: '⌘/' },
    ],
  },
  {
    title: 'Sidebar views',
    entries: [
      { label: 'Show Sessions', combo: '⇧⌘S' },
      { label: 'Show History', combo: '⇧⌘Y' },
      { label: 'Show Analytics', combo: '⇧⌘L' },
      { label: 'Show Plugins', combo: '⇧⌘P' },
      { label: 'Navigate sessions list', combo: '↑ / ↓' },
    ],
  },
  {
    title: 'Composer',
    entries: [
      { label: 'Send message', combo: 'Enter' },
      { label: 'Insert newline', combo: '⇧Enter' },
      { label: 'Stop streaming turn', combo: 'Esc' },
      { label: 'Slash command autocomplete', combo: '/' },
    ],
  },
];

/**
 * Render a canonical mac-form combo (with ⌘ ⇧ ⌥ ⌃ glyphs) for the active
 * platform. On Windows / Linux we swap to "Ctrl+", "Shift+", "Alt+", etc.,
 * matching the style we use in tooltips elsewhere in the app.
 */
export function renderCombo(combo: string, isMac: boolean): string {
  if (isMac) return combo;
  return combo
    .replaceAll('⌘', 'Ctrl+')
    .replaceAll('⇧', 'Shift+')
    .replaceAll('⌥', 'Alt+')
    .replaceAll('⌃', 'Ctrl+')
    .replaceAll('←', 'Left')
    .replaceAll('→', 'Right')
    .replaceAll('Ctrl+Tab', 'Ctrl+Tab')
    // After substitutions we may end with double "Ctrl+Ctrl+" if both ⌘ and
    // ⌃ were present — collapse runs of "Ctrl+".
    .replace(/(Ctrl\+)+/g, 'Ctrl+');
}
