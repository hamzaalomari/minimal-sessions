/**
 * Domain types shared across processes. Mirrors `specs/design.md §5`.
 * Both the renderer (Zustand store) and main (SQLite layer, later) use these.
 */

export type SessionId = string;

/** A specific model ID the API exposes, e.g. 'claude-sonnet-4-6'. */
export type ModelId = string;

export type ModelFamily = 'opus' | 'sonnet' | 'haiku';

export type ToolKind = 'read' | 'edit' | 'write' | 'search';

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'tool'; label: string; path: string; tag?: string }
  | {
      type: 'win';
      kind: ToolKind;
      path: string;
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
  turns: Turn[];
}
