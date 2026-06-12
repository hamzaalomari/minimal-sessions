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
  /** Extended thinking content from the model — collapsed by default. */
  | { type: 'thinking'; text: string }
  | { type: 'error'; message: string };

export interface Turn {
  id: string;
  role: 'user' | 'assistant';
  blocks: Block[];
  modelShort?: string;
  createdAt: number;
  /** Per-turn token usage. Present only on assistant turns from the SDK
   *  result message, and only on turns created after the per-turn usage
   *  migration shipped — older rows have no data here. */
  usage?: TokenUsage;
}

/**
 * Per-turn token counts as reported by the Agent SDK's `result.usage`.
 * The status-bar token meter aggregates these across the session and
 * estimates cost via the pricing table.
 */
export interface TokenUsage {
  input: number;
  output: number;
  /** Tokens written to the prompt cache (billed at ~1.25× input on Anthropic). */
  cacheCreation: number;
  /** Tokens read from the prompt cache (billed at ~0.1× input on Anthropic). */
  cacheRead: number;
}

export const ZERO_USAGE: TokenUsage = {
  input: 0,
  output: 0,
  cacheCreation: 0,
  cacheRead: 0,
};

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
  /** Sum of all turn token counts (input + output + cache). Kept for the legacy meter. */
  tokens: number;
  /** Per-category running totals. Computed from the same `result.usage` as `tokens`. */
  usage: TokenUsage;
  /** Claude Agent SDK session id from the most recent turn; '' if not yet started. */
  sdkSessionId: string;
  turns: Turn[];
}
