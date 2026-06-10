/**
 * Collapse the user's home directory in `absolute` to a leading `~` so the UI
 * doesn't show `/Users/<name>/...` everywhere. Paths that aren't under home,
 * or weren't absolute to begin with, are returned untouched.
 */
export function displayPath(absolute: string, home: string): string {
  if (!absolute) return absolute;
  if (!home) return absolute;
  if (absolute === home) return '~';
  const homeWithSep = home.endsWith('/') ? home : home + '/';
  if (absolute.startsWith(homeWithSep)) {
    return '~/' + absolute.slice(homeWithSep.length);
  }
  return absolute;
}

/**
 * Last path segment (basename) — used to auto-suggest a session name from the
 * picked folder. Works for both POSIX and Windows-style separators.
 */
export function basename(path: string): string {
  if (!path) return '';
  const trimmed = path.replace(/[\\/]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}
