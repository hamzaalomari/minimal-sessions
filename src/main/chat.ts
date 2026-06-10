/**
 * Streaming chat wrapper around `@anthropic-ai/claude-agent-sdk`.
 *
 * The SDK ships its own Claude binary and uses the device's existing Claude
 * Code auth (OAuth subscription or `ANTHROPIC_API_KEY`), so no in-app key
 * management is needed.
 *
 * We translate the SDK's `SDKMessage` stream into the renderer-facing
 * `ChatEvent` shape and append a final `Turn` to the session via the caller's
 * persistence layer.
 */

import { query as sdkQuery } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { Block, Session } from '@shared/types';
import { parseMarkdown } from '@shared/markdown';
import { pathForTool, summaryFor, toolKindFor } from '@shared/tool-display';

/** Events the renderer subscribes to per assistant turn. */
export type ChatEvent =
  | { type: 'turn-start'; turnId: string; modelShort?: string }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; toolId: string; name: string; input: unknown }
  | { type: 'tool-result'; toolId: string; content: string; isError?: boolean }
  | {
      type: 'turn-stop';
      turnId: string;
      blocks: Block[];
      addTokens: number;
      sdkSessionId: string;
    }
  | { type: 'error'; message: string };

export interface SendArgs {
  session: Session;
  userText: string;
  /** SDK session id from a prior turn, if any. Used to chain context. */
  resumeSdkSessionId?: string;
}

/** Minimal shape we depend on from the SDK so tests can inject a fake. */
export type QueryFn = (params: Parameters<typeof sdkQuery>[0]) => AsyncIterable<SDKMessage>;

const MODEL_SHORT = (id: string): string | undefined => {
  if (!id) return undefined;
  if (id.includes('opus')) return 'Opus';
  if (id.includes('sonnet')) return 'Sonnet';
  if (id.includes('haiku')) return 'Haiku';
  return undefined;
};

export async function runStreamingTurn(
  query: QueryFn,
  args: SendArgs,
  emit: (event: ChatEvent) => void,
  turnId: string,
): Promise<void> {
  const { session, userText, resumeSdkSessionId } = args;
  const blocks: Block[] = [];
  const toolWinIndex = new Map<string, number>();
  let modelShort: string | undefined;
  let addTokens = 0;
  let sdkSessionId = resumeSdkSessionId ?? '';
  let started = false;

  try {
    const iter = query({
      prompt: userText,
      options: {
        cwd: session.path,
        ...(session.model ? { model: session.model } : {}),
        ...(resumeSdkSessionId ? { resume: resumeSdkSessionId } : {}),
        ...(session.systemPrompt
          ? { systemPrompt: session.systemPrompt }
          : {}),
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        includePartialMessages: false,
      },
    });

    for await (const msg of iter as AsyncIterable<SDKMessage>) {
      if (msg.type === 'system' && (msg as SDKSystemMessage).subtype === 'init') {
        const init = msg as SDKSystemMessage;
        sdkSessionId = init.session_id || sdkSessionId;
        if (!started) {
          modelShort = MODEL_SHORT(init.model || session.model);
          emit({
            type: 'turn-start',
            turnId,
            ...(modelShort ? { modelShort } : {}),
          });
          started = true;
        }
        continue;
      }

      if (msg.type === 'assistant') {
        if (!started) {
          modelShort = MODEL_SHORT(session.model);
          emit({
            type: 'turn-start',
            turnId,
            ...(modelShort ? { modelShort } : {}),
          });
          started = true;
        }
        applyAssistant(msg as SDKAssistantMessage, blocks, toolWinIndex, emit);
        continue;
      }

      if (msg.type === 'user') {
        applyToolResults(msg as SDKUserMessage, blocks, toolWinIndex, emit);
        continue;
      }

      if (msg.type === 'result') {
        const result = msg as SDKResultMessage;
        sdkSessionId = result.session_id || sdkSessionId;
        addTokens =
          (result.usage?.input_tokens ?? 0) + (result.usage?.output_tokens ?? 0);
        if (result.subtype !== 'success') {
          const message = (result as { result?: string }).result || 'Claude returned an error.';
          blocks.push({ type: 'error', message });
          emit({ type: 'error', message });
        }
      }
    }

    if (!started) {
      emit({ type: 'turn-start', turnId });
    }
    emit({ type: 'turn-stop', turnId, blocks, addTokens, sdkSessionId });
  } catch (e) {
    const message = (e as Error)?.message || String(e);
    blocks.push({ type: 'error', message });
    emit({ type: 'error', message });
    emit({ type: 'turn-stop', turnId, blocks, addTokens, sdkSessionId });
  }
}

interface MessageContent {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

function applyAssistant(
  msg: SDKAssistantMessage,
  blocks: Block[],
  toolWinIndex: Map<string, number>,
  emit: (event: ChatEvent) => void,
): void {
  const content = (msg.message as { content?: MessageContent[] }).content;
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string' && part.text) {
      for (const b of parseMarkdown(part.text)) blocks.push(b);
      emit({ type: 'text-delta', text: part.text });
      continue;
    }
    if (part.type === 'tool_use' && part.id && part.name) {
      const kind = toolKindFor(part.name);
      const path = pathForTool(part.name, part.input);

      // Coalesce consecutive tool calls of the same kind into one window
      // (except bash — each command is its own thing).
      const last = blocks[blocks.length - 1];
      if (
        kind !== 'bash' &&
        last &&
        last.type === 'win' &&
        last.kind === kind
      ) {
        const lastIdx = blocks.length - 1;
        const existingPaths = last.paths ?? [last.path];
        const merged: Block = {
          ...last,
          paths: [...existingPaths, path],
        };
        blocks[lastIdx] = merged;
        toolWinIndex.set(part.id, lastIdx);
      } else {
        const idx = blocks.length;
        blocks.push({
          type: 'win',
          kind,
          path,
          summary: summaryFor(part.name, part.input),
          ...(kind === 'bash' ? { defaultOpen: true } : {}),
        });
        toolWinIndex.set(part.id, idx);
      }
      emit({
        type: 'tool-start',
        toolId: part.id,
        name: part.name,
        input: part.input ?? {},
      });
    }
  }
}

function applyToolResults(
  msg: SDKUserMessage,
  blocks: Block[],
  toolWinIndex: Map<string, number>,
  emit: (event: ChatEvent) => void,
): void {
  const content = (msg.message as { content?: MessageContent[] | string }).content;
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (part.type !== 'tool_result' || !part.tool_use_id) continue;
    const idx = toolWinIndex.get(part.tool_use_id);
    const text = stringifyToolResult(part.content);
    if (idx !== undefined) {
      const win = blocks[idx];
      if (win && win.type === 'win') {
        const isMulti = (win.paths?.length ?? 0) > 1;
        if (isMulti) {
          // For grouped windows show the file list — don't overwrite with
          // any single tool's output. Bubble up an error tag if anything failed.
          blocks[idx] = {
            ...win,
            tag: part.is_error ? 'error' : win.tag ?? 'ok',
          };
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
    emit({
      type: 'tool-result',
      toolId: part.tool_use_id,
      content: text,
      ...(part.is_error ? { isError: true } : {}),
    });
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

/** Re-export of the real SDK query, kept here so callers (and tests) can swap it. */
export const realQuery: QueryFn = sdkQuery as unknown as QueryFn;

export interface SdkModel {
  id: string;
  displayName: string;
  description: string;
}

/**
 * List the models the locally-installed Claude binary advertises.
 *
 * The SDK only exposes `supportedModels()` on a running `Query`, so we start
 * a streaming-input query that never yields, fetch the list, then abort.
 */
export async function listSupportedModels(): Promise<SdkModel[]> {
  const abort = new AbortController();
  const inputIter = (async function* () {
    // Block until the caller aborts; we never feed a real message in.
    await new Promise<void>((resolve) => {
      const onAbort = (): void => resolve();
      abort.signal.addEventListener('abort', onAbort, { once: true });
    });
  })();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (sdkQuery as any)({
    prompt: inputIter,
    options: { abortController: abort },
  });
  try {
    const models = await q.supportedModels();
    return models.map((m: { value: string; displayName: string; description: string }) => ({
      id: m.value,
      displayName: m.displayName,
      description: m.description,
    }));
  } finally {
    abort.abort();
  }
}
