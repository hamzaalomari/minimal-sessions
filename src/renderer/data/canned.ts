import type { Block } from '@shared/types';

const CANNED: Block[][] = [
  [
    {
      type: 'p',
      text: 'Good question. Let me look at the relevant code before I suggest anything concrete.',
    },
    {
      type: 'win',
      kind: 'read',
      path: 'src/index.ts',
      tag: '42 lines',
      summary: 'Read the entry point',
      lang: 'typescript',
      code: `export function main() {
  const app = createApp();
  registerRoutes(app);
  app.listen(PORT, () => log("ready"));
}`,
    },
    {
      type: 'p',
      text: "Here's what I'd do: isolate the change behind a small helper so it's easy to test, then wire it in. Want me to go ahead and make the edit?",
    },
  ],
  [
    {
      type: 'p',
      text: 'That should be a quick one. The cleanest approach is to handle it where the data first enters the system, rather than patching each call site.',
    },
    {
      type: 'p',
      text: 'I can implement it now and add a test that covers the edge case you mentioned — sound good?',
    },
  ],
  [
    { type: 'p', text: 'Got it. There are two reasonable ways to do this:' },
    {
      type: 'ul',
      items: [
        'A focused fix that solves exactly this case with minimal risk.',
        'A small refactor that prevents the whole class of bug from recurring.',
      ],
    },
    {
      type: 'p',
      text: "For where you are in the branch, I'd lean toward the focused fix now and file a note for the refactor. Want me to proceed?",
    },
  ],
];

let cursor = 0;

export function nextReply(): Block[] {
  const reply = CANNED[cursor % CANNED.length]!;
  cursor++;
  return reply.map((b) => ({ ...b }));
}

/** Test-only — reset the round-robin cursor so test ordering is deterministic. */
export function resetCannedCursor(): void {
  cursor = 0;
}
