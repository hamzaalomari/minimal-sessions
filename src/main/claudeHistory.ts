import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Read past Claude Code session history for a given working folder.
 *
 * Claude Code writes per-project session logs to `~/.claude/projects/<encoded>/<uuid>.jsonl`,
 * where the encoded folder name is the absolute cwd with `/` replaced by `-`
 * (e.g. `/Users/x/projects/foo` → `-Users-x-projects-foo`). Each line is one
 * record (queue-operation, user, assistant, tool-result, summary, …); the
 * `sessionId` matches the filename. We surface a tiny digest per file so the
 * renderer can show a "Resume past session" picker without paying the full
 * parse cost.
 */

export interface ClaudeHistoryEntry {
  sessionId: string;
  /** mtime of the jsonl (ms since epoch). Most-recently-active first. */
  modifiedAt: number;
  /** First non-empty user message text — up to ~200 chars — as a preview. */
  preview: string;
  /** Total user-message count. Useful to hide trivial sessions. */
  userTurnCount: number;
}

/** SDK `listSupportedModels()` issues a prompt with this exact text. Sessions
 *  whose only user turn matches it are noise from our own startup model-probe
 *  call, not real conversations — we drop them from the resume picker. */
const MODEL_PROBE_PROMPT = 'list-models';

function encodeCwd(cwd: string): string {
  return cwd.replace(/\//g, '-');
}

interface JsonlUserRecord {
  type?: string;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }> | string;
  };
}

function extractUserText(line: string): string | null {
  if (!line.includes('"type":"user"')) return null;
  let rec: JsonlUserRecord;
  try {
    rec = JSON.parse(line) as JsonlUserRecord;
  } catch {
    return null;
  }
  if (rec.type !== 'user') return null;
  const content = rec.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  for (const part of content) {
    if (part?.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
      return part.text;
    }
  }
  return null;
}

async function summarizeJsonl(filePath: string): Promise<{
  preview: string;
  userTurnCount: number;
} | null> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
  let preview = '';
  let userTurnCount = 0;
  for (const line of raw.split('\n')) {
    if (!line) continue;
    const text = extractUserText(line);
    if (text === null) continue;
    userTurnCount += 1;
    if (!preview) preview = text;
  }
  if (userTurnCount === 0) return null;
  return { preview, userTurnCount };
}

export async function listClaudeSessions(cwd: string): Promise<ClaudeHistoryEntry[]> {
  if (!cwd) return [];
  const projectsDir = join(homedir(), '.claude', 'projects', encodeCwd(cwd));
  let names: string[];
  try {
    names = await fs.readdir(projectsDir);
  } catch {
    return [];
  }
  const entries: ClaudeHistoryEntry[] = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const sessionId = name.slice(0, -'.jsonl'.length);
    const filePath = join(projectsDir, name);
    let mtime = 0;
    try {
      const stat = await fs.stat(filePath);
      mtime = stat.mtimeMs;
    } catch {
      continue;
    }
    const summary = await summarizeJsonl(filePath);
    if (!summary) continue;
    // Drop our own startup model-probe sessions — single "list-models" turn,
    // nothing else. Real users could conceivably send that exact text, but
    // never as the *only* turn; the 2-turn threshold disambiguates.
    if (
      summary.userTurnCount === 1 &&
      summary.preview.trim() === MODEL_PROBE_PROMPT
    ) {
      continue;
    }
    const trimmed = summary.preview.trim().replace(/\s+/g, ' ');
    entries.push({
      sessionId,
      modifiedAt: mtime,
      preview: trimmed.length > 200 ? trimmed.slice(0, 200) + '…' : trimmed,
      userTurnCount: summary.userTurnCount,
    });
  }
  entries.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return entries;
}
