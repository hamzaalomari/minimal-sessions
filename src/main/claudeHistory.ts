import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Block, Turn } from '@shared/types';
import { parseMarkdown } from '@shared/markdown';
import { pathForTool, summaryFor, toolKindFor } from '@shared/tool-display';

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

/**
 * Reconstruct user/assistant turns from a past session's JSONL so the
 * "Resume past session" flow can pre-populate the transcript before any new
 * messages are sent. Parses text, thinking, tool_use, and tool_result content
 * — mirrors the same Block shapes that `chat.ts` builds during live streaming.
 */

interface JsonlPart {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

interface JsonlRecord {
  type?: string;
  uuid?: string;
  timestamp?: string;
  message?: {
    role?: string;
    model?: string;
    content?: JsonlPart[] | string;
  };
}

function applyAssistantContent(
  content: JsonlPart[],
  blocks: Block[],
  toolWinIndex: Map<string, number>,
): void {
  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string' && part.text) {
      for (const b of parseMarkdown(part.text)) blocks.push(b);
      continue;
    }
    if (part.type === 'thinking') {
      const text = part.thinking ?? part.text ?? '';
      if (text) blocks.push({ type: 'thinking', text });
      continue;
    }
    if (part.type === 'tool_use' && part.id && part.name) {
      const kind = toolKindFor(part.name);
      const path = pathForTool(part.name, part.input);
      const last = blocks[blocks.length - 1];
      if (kind !== 'bash' && last && last.type === 'win' && last.kind === kind) {
        const lastIdx = blocks.length - 1;
        const existingPaths = last.paths ?? [last.path];
        blocks[lastIdx] = { ...last, paths: [...existingPaths, path] };
        toolWinIndex.set(part.id, lastIdx);
      } else {
        const idx = blocks.length;
        blocks.push({
          type: 'win',
          kind,
          path,
          summary: summaryFor(part.name, part.input),
        });
        toolWinIndex.set(part.id, idx);
      }
    }
  }
}

function applyToolResultsContent(
  content: JsonlPart[],
  blocks: Block[],
  toolWinIndex: Map<string, number>,
): void {
  for (const part of content) {
    if (part.type !== 'tool_result' || !part.tool_use_id) continue;
    const idx = toolWinIndex.get(part.tool_use_id);
    if (idx === undefined) continue;
    const win = blocks[idx];
    if (!win || win.type !== 'win') continue;
    const text = stringifyToolResult(part.content);
    const isMulti = (win.paths?.length ?? 0) > 1;
    if (isMulti) {
      blocks[idx] = { ...win, tag: part.is_error ? 'error' : win.tag ?? 'ok' };
    } else {
      blocks[idx] = {
        ...win,
        lang: 'text',
        code: text,
        tag: part.is_error ? 'error' : 'ok',
      };
    }
  }
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        typeof c === 'string'
          ? c
          : (c as { text?: string })?.text ?? JSON.stringify(c),
      )
      .join('\n');
  }
  if (content == null) return '';
  return JSON.stringify(content);
}

function modelShortFor(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (id.includes('opus')) return 'Opus';
  if (id.includes('sonnet')) return 'Sonnet';
  if (id.includes('haiku')) return 'Haiku';
  return undefined;
}

export async function loadClaudeSession(
  cwd: string,
  sessionId: string,
): Promise<Turn[]> {
  if (!cwd || !sessionId) return [];
  const filePath = join(
    homedir(),
    '.claude',
    'projects',
    encodeCwd(cwd),
    `${sessionId}.jsonl`,
  );
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return [];
  }

  const turns: Turn[] = [];
  let assistantBlocks: Block[] | null = null;
  let assistantTurnId: string | null = null;
  let assistantCreatedAt = 0;
  let assistantModelShort: string | undefined;
  const toolWinIndex = new Map<string, number>();

  const flushAssistant = (): void => {
    if (
      assistantBlocks &&
      assistantBlocks.length > 0 &&
      assistantTurnId
    ) {
      turns.push({
        id: assistantTurnId,
        role: 'assistant',
        blocks: assistantBlocks,
        createdAt: assistantCreatedAt,
        ...(assistantModelShort ? { modelShort: assistantModelShort } : {}),
      });
    }
    assistantBlocks = null;
    assistantTurnId = null;
    assistantCreatedAt = 0;
    assistantModelShort = undefined;
    toolWinIndex.clear();
  };

  for (const line of raw.split('\n')) {
    if (!line) continue;
    let rec: JsonlRecord;
    try {
      rec = JSON.parse(line) as JsonlRecord;
    } catch {
      continue;
    }
    const ts = rec.timestamp ? Date.parse(rec.timestamp) : 0;

    if (rec.type === 'user') {
      const content = rec.message?.content;
      const parts: JsonlPart[] =
        typeof content === 'string'
          ? [{ type: 'text', text: content }]
          : Array.isArray(content)
            ? content
            : [];

      // Tool results attach to the still-open assistant turn (they're the
      // "user" side of a tool round-trip, not a real user message).
      if (assistantBlocks && parts.some((p) => p.type === 'tool_result')) {
        applyToolResultsContent(parts, assistantBlocks, toolWinIndex);
      }

      const textPart = parts.find(
        (p): p is JsonlPart & { text: string } =>
          p.type === 'text' && typeof p.text === 'string' && p.text.trim() !== '',
      );
      if (textPart) {
        // A real user message ends the previous assistant turn.
        flushAssistant();
        turns.push({
          id: rec.uuid ?? `u-${turns.length}`,
          role: 'user',
          blocks: parseMarkdown(textPart.text),
          createdAt: ts || Date.now(),
        });
      }
      continue;
    }

    if (rec.type === 'assistant') {
      const content = rec.message?.content;
      if (!Array.isArray(content)) continue;
      if (!assistantBlocks) {
        assistantBlocks = [];
        assistantTurnId = rec.uuid ?? `a-${turns.length}`;
        assistantCreatedAt = ts || Date.now();
        assistantModelShort = modelShortFor(rec.message?.model);
      }
      applyAssistantContent(content, assistantBlocks, toolWinIndex);
      continue;
    }
  }
  flushAssistant();

  return turns;
}
