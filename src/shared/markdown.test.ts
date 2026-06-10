import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('returns a single paragraph for plain text', () => {
    expect(parseMarkdown('Hello world')).toEqual([{ type: 'p', text: 'Hello world' }]);
  });

  it('splits paragraphs on blank lines', () => {
    expect(parseMarkdown('one\n\ntwo')).toEqual([
      { type: 'p', text: 'one' },
      { type: 'p', text: 'two' },
    ]);
  });

  it('parses ATX headers', () => {
    expect(parseMarkdown('# Title\n\nbody')).toEqual([
      { type: 'h', text: 'Title' },
      { type: 'p', text: 'body' },
    ]);
  });

  it('parses unordered lists', () => {
    expect(parseMarkdown('- a\n- b\n- c')).toEqual([
      { type: 'ul', items: ['a', 'b', 'c'] },
    ]);
  });

  it('parses ordered lists', () => {
    expect(parseMarkdown('1. first\n2. second')).toEqual([
      { type: 'ul', items: ['first', 'second'] },
    ]);
  });

  it('parses fenced code blocks with a language', () => {
    expect(parseMarkdown('```ts\nconst x = 1\n```')).toEqual([
      { type: 'code', lang: 'ts', code: 'const x = 1' },
    ]);
  });

  it('parses fenced code blocks without a language', () => {
    expect(parseMarkdown('```\nplain\n```')).toEqual([
      { type: 'code', lang: '', code: 'plain' },
    ]);
  });

  it('mixes paragraphs, lists, and code blocks', () => {
    const md = `Intro line.

## Steps

- read file
- write file

\`\`\`bash
ls -la
\`\`\`

Done.`;
    expect(parseMarkdown(md)).toEqual([
      { type: 'p', text: 'Intro line.' },
      { type: 'h', text: 'Steps' },
      { type: 'ul', items: ['read file', 'write file'] },
      { type: 'code', lang: 'bash', code: 'ls -la' },
      { type: 'p', text: 'Done.' },
    ]);
  });

  it('keeps multi-line paragraphs joined with newlines', () => {
    expect(parseMarkdown('first line\nsecond line')).toEqual([
      { type: 'p', text: 'first line\nsecond line' },
    ]);
  });

  it('parses a GFM pipe table', () => {
    const md = `| Layer | Path | Purpose |
|-------|------|---------|
| Domain | \`pkg/domain/\` | core stuff |
| Repository | \`pkg/repository/\` | data access |`;
    expect(parseMarkdown(md)).toEqual([
      {
        type: 'table',
        headers: ['Layer', 'Path', 'Purpose'],
        rows: [
          ['Domain', '`pkg/domain/`', 'core stuff'],
          ['Repository', '`pkg/repository/`', 'data access'],
        ],
      },
    ]);
  });

  it('does not treat plain pipe text as a table without a separator', () => {
    const md = `Pipe | not | a table`;
    expect(parseMarkdown(md)).toEqual([
      { type: 'p', text: 'Pipe | not | a table' },
    ]);
  });

  it('separates a preceding paragraph from a table', () => {
    const md = `Some intro text.
| A | B |
|---|---|
| 1 | 2 |`;
    expect(parseMarkdown(md)).toEqual([
      { type: 'p', text: 'Some intro text.' },
      { type: 'table', headers: ['A', 'B'], rows: [['1', '2']] },
    ]);
  });
});
