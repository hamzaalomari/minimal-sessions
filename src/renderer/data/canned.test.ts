import { beforeEach, describe, expect, it } from 'vitest';
import { nextReply, resetCannedCursor } from './canned';

describe('nextReply', () => {
  beforeEach(() => resetCannedCursor());

  it('returns a non-empty block array', () => {
    const reply = nextReply();
    expect(reply.length).toBeGreaterThan(0);
    for (const b of reply) expect(b.type).toBeTypeOf('string');
  });

  it('cycles through three distinct replies in round-robin order', () => {
    const a = nextReply();
    const b = nextReply();
    const c = nextReply();
    const d = nextReply();
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a).toEqual(d); // wraps back to the first reply
  });

  it('returns fresh block copies each call so callers can mutate safely', () => {
    const a = nextReply();
    const b = nextReply();
    const c = nextReply();
    const a2 = nextReply(); // back to reply 0
    expect(a).not.toBe(a2);
    expect(a[0]).not.toBe(a2[0]);
    expect(a).toEqual(a2);
    void b;
    void c;
  });
});
