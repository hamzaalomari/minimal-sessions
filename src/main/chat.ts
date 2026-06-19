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
import type { Block, Session, TokenUsage } from '@shared/types';
import { ZERO_USAGE } from '@shared/types';
import { parseMarkdown } from '@shared/markdown';
import { pathForTool, summaryFor, toolKindFor } from '@shared/tool-display';
import { discoverPlugins } from './plugins';
import { log } from './log';

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
      /** Sum of all token categories. Equals usage.input + output + cacheCreation + cacheRead. */
      addTokens: number;
      /** Per-category breakdown so the status-bar meter can split + price it. */
      addUsage: TokenUsage;
      sdkSessionId: string;
    }
  | { type: 'error'; message: string };

export interface SendArgs {
  session: Session;
  userText: string;
  /** SDK session id from a prior turn, if any. Used to chain context. */
  resumeSdkSessionId?: string;
  /** Aborting the controller mid-turn cancels the SDK stream — analog of Esc in the Claude CLI. */
  abortController?: AbortController;
  /** Global system prompt (from Tweaks) — prepended to `session.systemPrompt`. */
  globalSystemPrompt?: string;
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
  const {
    session,
    userText,
    resumeSdkSessionId,
    abortController,
    globalSystemPrompt,
  } = args;
  const effectiveSystemPrompt = [globalSystemPrompt, session.systemPrompt]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
  const blocks: Block[] = [];
  const toolWinIndex = new Map<string, number>();
  let modelShort: string | undefined;
  const addUsage: TokenUsage = { ...ZERO_USAGE };
  let sdkSessionId = resumeSdkSessionId ?? '';
  let started = false;
  /** Flipped true once a `stream_event` text_delta has been forwarded to the
   *  renderer. When true, the subsequent full `assistant` message skips its
   *  own text-delta emit (the live overlay already has the text). When false
   *  — e.g. the SDK didn't emit partials, or tests inject a non-streaming
   *  mock — the assistant message emits text-delta as a fallback. */
  let streamedAnyText = false;

  // Pick up any installed Claude Code plugins so their slash commands, skills,
  // hooks, and MCP servers come along for the ride. Discovery is cached briefly
  // so this is effectively free across turns of the same session.
  const plugins = discoverPlugins(session.path);

  log('chat', 'runStreamingTurn:start', {
    sessionId: session.id,
    turnId,
    cwd: session.path,
    model: session.model,
    resume: Boolean(resumeSdkSessionId),
    plugins: plugins.length,
    promptLen: userText.length,
  });

  let messageCount = 0;
  try {
    const iter = query({
      prompt: userText,
      options: {
        cwd: session.path,
        ...(session.model ? { model: session.model } : {}),
        ...(resumeSdkSessionId ? { resume: resumeSdkSessionId } : {}),
        ...(effectiveSystemPrompt
          ? { systemPrompt: effectiveSystemPrompt }
          : {}),
        ...(abortController ? { abortController } : {}),
        ...(plugins.length > 0 ? { plugins } : {}),
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        // Stream content_block_delta events so the UI can render the response
        // token-by-token. Without this the SDK only yields complete assistant
        // messages, so the user sees a blank "loading" until the whole reply
        // is built — perceived as a long wait even when generation has begun.
        includePartialMessages: true,
      },
    });
    log('chat', 'sdk:iterator-created', { turnId });

    for await (const msg of iter as AsyncIterable<SDKMessage>) {
      messageCount += 1;
      if (messageCount === 1) {
        log('chat', 'sdk:first-message', {
          turnId,
          type: msg.type,
          subtype: (msg as { subtype?: string }).subtype,
        });
      }
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

      // Partial stream events — token-by-token deltas. We surface text deltas
      // to the renderer immediately so the UI fills in as Claude generates;
      // the eventual full `assistant` message still arrives later and builds
      // the canonical `blocks` array (with markdown structure) for persistence.
      if (msg.type === 'stream_event') {
        const event = (msg as { event?: unknown }).event as
          | { type?: string; delta?: { type?: string; text?: string } }
          | undefined;
        if (
          event?.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          typeof event.delta.text === 'string' &&
          event.delta.text
        ) {
          if (!started) {
            modelShort = MODEL_SHORT(session.model);
            emit({
              type: 'turn-start',
              turnId,
              ...(modelShort ? { modelShort } : {}),
            });
            started = true;
          }
          streamedAnyText = true;
          emit({ type: 'text-delta', text: event.delta.text });
        }
        continue;
      }

      // Local slash commands (e.g. /usage, /cost, /help, /clear) emit a
      // `local_command_output` system message instead of going through the
      // model. Surface its content as assistant text so the user sees the
      // result inline in the transcript.
      if (
        msg.type === 'system' &&
        (msg as { subtype?: string }).subtype === 'local_command_output'
      ) {
        const out = msg as { content?: string };
        const text = out.content ?? '';
        if (text) {
          if (!started) {
            emit({ type: 'turn-start', turnId });
            started = true;
          }
          for (const b of parseMarkdown(text)) blocks.push(b);
          emit({ type: 'text-delta', text });
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
        // If partials already streamed the text into the overlay, skip the
        // re-emit (would double the visible text). Otherwise emit as before so
        // non-streaming consumers (e.g. tests, SDK without partial support)
        // still see live text. Either way `blocks` is rebuilt from the
        // canonical full message for markdown-aware persistence + tool_use coalescing.
        applyAssistant(msg as SDKAssistantMessage, blocks, toolWinIndex, emit, {
          suppressTextDelta: streamedAnyText,
        });
        continue;
      }

      if (msg.type === 'user') {
        applyToolResults(msg as SDKUserMessage, blocks, toolWinIndex, emit);
        continue;
      }

      if (msg.type === 'result') {
        const result = msg as SDKResultMessage;
        sdkSessionId = result.session_id || sdkSessionId;
        const u = result.usage as
          | {
              input_tokens?: number;
              output_tokens?: number;
              cache_creation_input_tokens?: number;
              cache_read_input_tokens?: number;
            }
          | undefined;
        addUsage.input = u?.input_tokens ?? 0;
        addUsage.output = u?.output_tokens ?? 0;
        addUsage.cacheCreation = u?.cache_creation_input_tokens ?? 0;
        addUsage.cacheRead = u?.cache_read_input_tokens ?? 0;
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
    // Empty-turn fallback. The SDK occasionally returns init + success with
    // no content (e.g. when a slash command isn't recognised). Showing nothing
    // looks like a UI bug; this is a quiet marker.
    if (blocks.length === 0) {
      blocks.push({ type: 'p', text: '(no response)' });
    }
    const addTokens =
      addUsage.input + addUsage.output + addUsage.cacheCreation + addUsage.cacheRead;
    log('chat', 'runStreamingTurn:done', {
      turnId,
      messages: messageCount,
      addTokens,
      blocks: blocks.length,
    });
    emit({ type: 'turn-stop', turnId, blocks, addTokens, addUsage, sdkSessionId });
  } catch (e) {
    // If the user pressed Stop, surface a short "Stopped." marker rather than
    // an angry red error block — matches the Claude CLI's behavior on Esc.
    const aborted =
      abortController?.signal.aborted === true ||
      (e as Error)?.name === 'AbortError';
    if (aborted) {
      log('chat', 'runStreamingTurn:aborted', { turnId, messages: messageCount });
      blocks.push({ type: 'p', text: 'Stopped.' });
    } else {
      const message = (e as Error)?.message || String(e);
      log('chat', 'runStreamingTurn:error', {
        turnId,
        messages: messageCount,
        name: (e as Error)?.name,
        message,
      });
      blocks.push({ type: 'error', message });
      emit({ type: 'error', message });
    }
    const addTokens =
      addUsage.input + addUsage.output + addUsage.cacheCreation + addUsage.cacheRead;
    emit({ type: 'turn-stop', turnId, blocks, addTokens, addUsage, sdkSessionId });
  }
}

interface MessageContent {
  type: string;
  text?: string;
  /** Anthropic `thinking` blocks carry their content in `thinking`, not `text`. */
  thinking?: string;
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
  opts: { suppressTextDelta?: boolean } = {},
): void {
  const content = (msg.message as { content?: MessageContent[] }).content;
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (part.type === 'text' && typeof part.text === 'string' && part.text) {
      for (const b of parseMarkdown(part.text)) blocks.push(b);
      if (!opts.suppressTextDelta) {
        emit({ type: 'text-delta', text: part.text });
      }
      continue;
    }
    // Extended thinking — render as its own collapsible block. The SDK
    // ships these as `{ type: 'thinking', thinking: '…' }` (not `text`).
    // We don't emit text-delta for thinking content so it doesn't pollute
    // the live overlay; the user sees it once turn-stop swaps blocks in.
    if (part.type === 'thinking') {
      const text = part.thinking ?? part.text ?? '';
      if (text) blocks.push({ type: 'thinking', text });
      continue;
    }
    if (part.type !== 'tool_use') {
      // Forward-compatibility: salvage any text-bearing block we don't know
      // about (e.g. future SDK block types) so the user always sees content.
      const salvage =
        typeof part.text === 'string' && part.text
          ? part.text
          : typeof part.content === 'string' && part.content
            ? part.content
            : '';
      if (salvage) {
        for (const b of parseMarkdown(salvage)) blocks.push(b);
        emit({ type: 'text-delta', text: salvage });
      } else {
        console.warn('[chat] unhandled assistant content block type:', part.type);
      }
      continue;
    }
    if (part.id && part.name) {
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
 * `supportedModels()` lives on a `Query`, which needs a prompt to be created.
 * We pass a trivial string prompt and abort immediately after the SDK has
 * resolved its init response so no API call is ever made.
 */
export async function listSupportedModels(): Promise<SdkModel[]> {
  log('models', 'supportedModels:start');
  const abort = new AbortController();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (sdkQuery as any)({
    prompt: 'list-models',
    options: { abortController: abort },
  });
  const timeoutMs = 8000;
  const timeoutP = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`supportedModels() timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const raw = await Promise.race([q.supportedModels(), timeoutP]);
    const list = raw as Array<{ value: string; displayName: string; description: string }>;
    log('models', 'supportedModels:ok', {
      count: list.length,
      ids: list.map((m) => m.value),
    });
    return list.map((m) => ({
      id: m.value,
      displayName: m.displayName,
      description: m.description,
    }));
  } catch (e) {
    log('models', 'supportedModels:error', {
      name: (e as Error)?.name,
      message: (e as Error)?.message,
    });
    throw e;
  } finally {
    abort.abort();
  }
}
