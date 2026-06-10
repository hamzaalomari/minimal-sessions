/**
 * Display mapping for Claude Agent SDK tool calls.
 *
 * Used by both the main process (when constructing the canonical `win` block
 * on tool-use) and the renderer (when painting the live streaming overlay
 * before `turn-stop` arrives).
 */

import type { ToolKind } from './types';

const TOOL_KIND_FOR: Record<string, ToolKind> = {
  Read: 'read',
  Glob: 'read',
  LS: 'read',
  Grep: 'search',
  WebSearch: 'search',
  Write: 'write',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Bash: 'bash',
  WebFetch: 'read',
};

export function toolKindFor(name: string): ToolKind {
  return TOOL_KIND_FOR[name] ?? 'read';
}

/** What to put in the window header's path slot. */
export function pathForTool(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  if (name === 'Bash' && typeof i['command'] === 'string') {
    return i['command'] as string;
  }
  if (typeof i['file_path'] === 'string') return i['file_path'] as string;
  if (typeof i['path'] === 'string') return i['path'] as string;
  if (typeof i['pattern'] === 'string') return i['pattern'] as string;
  return '';
}

/** Optional one-line label under the header (Claude's own `description`). */
export function summaryFor(name: string, input: unknown): string {
  const i = (input ?? {}) as Record<string, unknown>;
  if (name === 'Bash' && typeof i['description'] === 'string') {
    return i['description'] as string;
  }
  return '';
}
