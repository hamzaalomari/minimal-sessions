/**
 * Domain types shared across processes. Mirrors `specs/design.md §5`.
 * Both the renderer (Zustand store) and main (SQLite layer, later) use these.
 */

export type SessionId = string;

/** A specific model ID the API exposes, e.g. 'claude-sonnet-4-6'. */
export type ModelId = string;

export type ModelFamily = 'opus' | 'sonnet' | 'haiku';

export type ToolKind = 'read' | 'edit' | 'write' | 'search' | 'bash';

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'tool'; label: string; path: string; tag?: string }
  | {
      type: 'win';
      kind: ToolKind;
      path: string;
      /** When set, this window represents multiple tool calls coalesced into one. */
      paths?: string[];
      tag?: string;
      summary?: string;
      lang?: string;
      code?: string;
      diff?: string;
      defaultOpen?: boolean;
    }
  | { type: 'error'; message: string };

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  blocks: Block[];
  modelShort?: string;
  createdAt: number;
}

export interface Session {
  id: SessionId;
  name: string;
  path: string;
  model: ModelId;
  /** Empty string means no system prompt. */
  systemPrompt: string;
  branch: string;
  createdAt: number;
  lastActiveAt: number;
  tokens: number;
  /** Claude Agent SDK session id from the most recent turn; '' if not yet started. */
  sdkSessionId: string;
  turns: Turn[];
}
