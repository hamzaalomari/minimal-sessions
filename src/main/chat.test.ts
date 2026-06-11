import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@shared/types';
import { runStreamingTurn, type ChatEvent, type QueryFn } from './chat';

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 's1',
    name: 'test',
    path: '/tmp/fake',
    model: 'claude-sonnet-4-6',
    systemPrompt: '',
    branch: '',
    createdAt: 0,
    lastActiveAt: 0,
    tokens: 0,
    usage: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 },
    sdkSessionId: '',
    turns: [],
    ...overrides,
  };
}

function fakeQuery(messages: unknown[]): QueryFn {
  return () => ({
    async *[Symbol.asyncIterator]() {
      for (const m of messages) yield m as never;
    },
  });
}

describe('runStreamingTurn', () => {
  it('emits turn-start with model short name, text-delta, and turn-stop', async () => {
    const events: ChatEvent[] = [];
    const query = fakeQuery([
      {
        type: 'system',
        subtype: 'init',
        session_id: 'sdk-1',
        model: 'claude-sonnet-4-6',
      },
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'hello world' }] },
      },
      {
        type: 'result',
        subtype: 'success',
        session_id: 'sdk-1',
        usage: { input_tokens: 12, output_tokens: 8 },
      },
    ]);

    await runStreamingTurn(
      query,
      { session: mkSession(), userText: 'hi' },
      (e) => events.push(e),
      'tid',
    );

    expect(events[0]).toMatchObject({ type: 'turn-start', turnId: 'tid', modelShort: 'Sonnet' });
    expect(events.some((e) => e.type === 'text-delta' && e.text === 'hello world')).toBe(true);
    const stop = events.find((e) => e.type === 'turn-stop');
    expect(stop).toMatchObject({
      type: 'turn-stop',
      sdkSessionId: 'sdk-1',
      addTokens: 20,
      addUsage: { input: 12, output: 8, cacheCreation: 0, cacheRead: 0 },
    });
    if (stop?.type === 'turn-stop') {
      expect(stop.blocks).toEqual([{ type: 'p', text: 'hello world' }]);
    }
  });

  it('runs a tool_use and folds the tool_result into the same win block', async () => {
    const events: ChatEvent[] = [];
    const query = fakeQuery([
      { type: 'system', subtype: 'init', session_id: 'sdk-2', model: 'claude-opus-4-6' },
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'Read',
              input: { file_path: '/tmp/fake/README.md' },
            },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'file contents' },
          ],
        },
      },
      {
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'done' }] },
      },
      {
        type: 'result',
        subtype: 'success',
        session_id: 'sdk-2',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);

    await runStreamingTurn(
      query,
      { session: mkSession(), userText: 'read it' },
      (e) => events.push(e),
      'tid',
    );

    expect(events.some((e) => e.type === 'tool-start' && e.name === 'Read')).toBe(true);
    expect(
      events.some((e) => e.type === 'tool-result' && e.content === 'file contents'),
    ).toBe(true);
    const stop = events.find((e) => e.type === 'turn-stop');
    if (stop?.type === 'turn-stop') {
      const win = stop.blocks.find((b) => b.type === 'win');
      expect(win).toMatchObject({
        kind: 'read',
        path: '/tmp/fake/README.md',
        code: 'file contents',
        tag: 'ok',
      });
      expect(stop.blocks.some((b) => b.type === 'p' && b.text === 'done')).toBe(true);
    }
  });

  it('passes resume + cwd + systemPrompt to the SDK', async () => {
    const querySpy = vi.fn(fakeQuery([
      { type: 'result', subtype: 'success', session_id: 'sdk-3', usage: { input_tokens: 0, output_tokens: 0 } },
    ]));
    await runStreamingTurn(
      querySpy as unknown as QueryFn,
      {
        session: mkSession({ systemPrompt: 'be brief', path: '/tmp/fake' }),
        userText: 'hi',
        resumeSdkSessionId: 'old-sdk-id',
      },
      () => {},
      'tid',
    );
    const args = querySpy.mock.calls[0]?.[0] as {
      prompt: string;
      options: Record<string, unknown>;
    };
    expect(args.prompt).toBe('hi');
    expect(args.options['cwd']).toBe('/tmp/fake');
    expect(args.options['systemPrompt']).toBe('be brief');
    expect(args.options['resume']).toBe('old-sdk-id');
  });

  it('prepends globalSystemPrompt to the session systemPrompt with a blank line', async () => {
    const querySpy = vi.fn(fakeQuery([
      { type: 'result', subtype: 'success', session_id: 'sdk-g1', usage: { input_tokens: 0, output_tokens: 0 } },
    ]));
    await runStreamingTurn(
      querySpy as unknown as QueryFn,
      {
        session: mkSession({ systemPrompt: 'be brief' }),
        userText: 'hi',
        globalSystemPrompt: 'always respond in markdown',
      },
      () => {},
      'tid',
    );
    const args = querySpy.mock.calls[0]?.[0] as { options: Record<string, unknown> };
    expect(args.options['systemPrompt']).toBe(
      'always respond in markdown\n\nbe brief',
    );
  });

  it('uses globalSystemPrompt alone when the session has none', async () => {
    const querySpy = vi.fn(fakeQuery([
      { type: 'result', subtype: 'success', session_id: 'sdk-g2', usage: { input_tokens: 0, output_tokens: 0 } },
    ]));
    await runStreamingTurn(
      querySpy as unknown as QueryFn,
      {
        session: mkSession({ systemPrompt: '' }),
        userText: 'hi',
        globalSystemPrompt: 'be terse',
      },
      () => {},
      'tid',
    );
    const args = querySpy.mock.calls[0]?.[0] as { options: Record<string, unknown> };
    expect(args.options['systemPrompt']).toBe('be terse');
  });

  it('omits systemPrompt entirely when neither global nor session is set', async () => {
    const querySpy = vi.fn(fakeQuery([
      { type: 'result', subtype: 'success', session_id: 'sdk-g3', usage: { input_tokens: 0, output_tokens: 0 } },
    ]));
    await runStreamingTurn(
      querySpy as unknown as QueryFn,
      {
        session: mkSession({ systemPrompt: '' }),
        userText: 'hi',
        globalSystemPrompt: '   ',
      },
      () => {},
      'tid',
    );
    const args = querySpy.mock.calls[0]?.[0] as { options: Record<string, unknown> };
    expect(args.options['systemPrompt']).toBeUndefined();
  });

  it('emits an error block when the SDK throws', async () => {
    const query: QueryFn = () => {
      throw new Error('not authenticated');
    };
    const events: ChatEvent[] = [];
    await runStreamingTurn(
      query,
      { session: mkSession(), userText: 'hi' },
      (e) => events.push(e),
      'tid',
    );
    expect(events.find((e) => e.type === 'error')).toMatchObject({
      message: 'not authenticated',
    });
    const stop = events.find((e) => e.type === 'turn-stop');
    if (stop?.type === 'turn-stop') {
      expect(stop.blocks.some((b) => b.type === 'error')).toBe(true);
    }
  });

  it('coalesces consecutive reads into a single multi-path win block', async () => {
    const events: ChatEvent[] = [];
    const query = fakeQuery([
      { type: 'system', subtype: 'init', session_id: 'sdk-c', model: 'claude-sonnet-4-6' },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/r/a.go' } },
            { type: 'tool_use', id: 'tu_2', name: 'Read', input: { file_path: '/r/b.go' } },
            { type: 'tool_use', id: 'tu_3', name: 'Read', input: { file_path: '/r/c.go' } },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tu_1', content: 'A' },
            { type: 'tool_result', tool_use_id: 'tu_2', content: 'B' },
            { type: 'tool_result', tool_use_id: 'tu_3', content: 'C' },
          ],
        },
      },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } },
      {
        type: 'result',
        subtype: 'success',
        session_id: 'sdk-c',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);
    await runStreamingTurn(
      query,
      { session: mkSession(), userText: 'read these' },
      (e) => events.push(e),
      'tid',
    );
    const stop = events.find((e) => e.type === 'turn-stop');
    if (stop?.type === 'turn-stop') {
      const wins = stop.blocks.filter((b) => b.type === 'win');
      expect(wins).toHaveLength(1);
      const w = wins[0];
      if (w && w.type === 'win') {
        expect(w.kind).toBe('read');
        expect(w.paths).toEqual(['/r/a.go', '/r/b.go', '/r/c.go']);
        // Multi-path windows don't carry the individual file body.
        expect(w.code).toBeUndefined();
      }
    }
  });

  it('does not coalesce bash commands', async () => {
    const events: ChatEvent[] = [];
    const query = fakeQuery([
      { type: 'system', subtype: 'init', session_id: 'sdk-b', model: 'claude-sonnet-4-6' },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'ls' } },
            { type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'pwd' } },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 't1', content: 'a.go' },
            { type: 'tool_result', tool_use_id: 't2', content: '/tmp' },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        session_id: 'sdk-b',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    ]);
    await runStreamingTurn(
      query,
      { session: mkSession(), userText: 'run' },
      (e) => events.push(e),
      'tid',
    );
    const stop = events.find((e) => e.type === 'turn-stop');
    if (stop?.type === 'turn-stop') {
      const wins = stop.blocks.filter((b) => b.type === 'win');
      expect(wins).toHaveLength(2);
    }
  });

  it('reports error result subtype as a chat error block', async () => {
    const query = fakeQuery([
      { type: 'system', subtype: 'init', session_id: 'sdk-4', model: 'claude-sonnet-4-6' },
      {
        type: 'result',
        subtype: 'error',
        session_id: 'sdk-4',
        result: 'over rate limit',
        usage: { input_tokens: 0, output_tokens: 0 },
      },
    ]);
    const events: ChatEvent[] = [];
    await runStreamingTurn(
      query,
      { session: mkSession(), userText: 'hi' },
      (e) => events.push(e),
      'tid',
    );
    expect(events.some((e) => e.type === 'error' && /rate limit/.test(e.message))).toBe(
      true,
    );
  });

  it('forwards an AbortController to the SDK and emits a "Stopped." block on abort', async () => {
    const abortController = new AbortController();
    abortController.abort();
    // Simulate the SDK throwing AbortError once its signal fires.
    const querySpy = vi.fn((() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }) as unknown as QueryFn);
    const events: ChatEvent[] = [];
    await runStreamingTurn(
      querySpy,
      { session: mkSession(), userText: 'hi', abortController },
      (e) => events.push(e),
      'tid',
    );
    const args = querySpy.mock.calls[0]?.[0] as { options: Record<string, unknown> };
    expect(args.options['abortController']).toBe(abortController);
    // No 'error' event should fire on a deliberate abort.
    expect(events.find((e) => e.type === 'error')).toBeUndefined();
    const stop = events.find((e) => e.type === 'turn-stop');
    if (stop?.type === 'turn-stop') {
      expect(stop.blocks).toEqual([{ type: 'p', text: 'Stopped.' }]);
    }
  });

  it('captures cache creation / read tokens from the SDK result', async () => {
    const events: ChatEvent[] = [];
    const query = fakeQuery([
      { type: 'system', subtype: 'init', session_id: 'sdk-5', model: 'claude-sonnet-4-6' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'k' }] } },
      {
        type: 'result',
        subtype: 'success',
        session_id: 'sdk-5',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 200,
          cache_read_input_tokens: 400,
        },
      },
    ]);
    await runStreamingTurn(
      query,
      { session: mkSession(), userText: 'hi' },
      (e) => events.push(e),
      'tid',
    );
    const stop = events.find((e) => e.type === 'turn-stop');
    expect(stop).toMatchObject({
      addTokens: 750,
      addUsage: {
        input: 100,
        output: 50,
        cacheCreation: 200,
        cacheRead: 400,
      },
    });
  });
});
