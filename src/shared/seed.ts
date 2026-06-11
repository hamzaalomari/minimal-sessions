import type { Block, Session, TokenUsage, Turn } from '@shared/types';

let counter = 0;
const uid = (): string => `seed-${++counter}-${Math.random().toString(36).slice(2, 7)}`;

/** Split a rough total into a realistic input/output mix (~70% input, 30% output). */
const splitUsage = (total: number): TokenUsage => {
  const input = Math.round(total * 0.7);
  const output = total - input;
  return { input, output, cacheCreation: 0, cacheRead: 0 };
};

const P = (text: string): Block => ({ type: 'p', text });
const H = (text: string): Block => ({ type: 'h', text });
const UL = (...items: string[]): Block => ({ type: 'ul', items });
const CODE = (lang: string, code: string): Block => ({ type: 'code', lang, code });

const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const U = (...blocks: Block[]): Turn => ({
  id: uid(),
  role: 'user',
  blocks,
  createdAt: NOW,
});

const A = (modelShort: string, ...blocks: Block[]): Turn => ({
  id: uid(),
  role: 'assistant',
  blocks,
  modelShort,
  createdAt: NOW,
});

export const SEED_SESSIONS: Session[] = [
  {
    id: uid(),
    name: 'auth-service refactor',
    model: 'claude-sonnet-4-6',
    systemPrompt: '',
    path: '~/dev/acme/auth-service',
    branch: 'feat/session-store',
    createdAt: NOW - 2 * HOUR,
    lastActiveAt: NOW - 2 * MIN,
    tokens: 48_200,
    usage: splitUsage(48_200),
    sdkSessionId: '',
    turns: [
      U(
        P(
          "The login flow keeps logging users out after ~15 minutes even though the token says it's valid for an hour. Can you find out why?",
        ),
      ),
      A(
        'Sonnet',
        P(
          "Let me trace how sessions are validated. I'll start with the middleware that runs on every request.",
        ),
        {
          type: 'win',
          kind: 'read',
          path: 'src/middleware/session.ts',
          tag: '58 lines',
          summary: 'Read the session middleware',
          lang: 'typescript',
          code: `export async function requireSession(req, res) {
  const token  = req.cookies.sid;
  const claims = verify(token, SECRET);

  const IDLE_MS = 15 * 60 * 1000;          // idle window
  if (Date.now() - claims.iat * 1000 > IDLE_MS) {
    return reject(res, "session_expired");
  }
  return claims;
}`,
        },
        P(
          "Found it. The middleware compares the token's `iat` (issued-at) against a hard-coded **15-minute** window, not the token's own expiry — so a perfectly valid 1-hour token is still rejected once 15 minutes pass since it was issued. The idle timeout should reset on activity, and shouldn't override the token's real `exp`.",
        ),
      ),
      U(
        P(
          'Right — we do want an idle timeout, but it should be a rolling 30 minutes based on last activity. Can you fix it?',
        ),
      ),
      A(
        'Sonnet',
        P(
          "Done. I switched it to a rolling window keyed on `lastSeen`, which we already write to Redis on each request, and I let the token's own `exp` be the hard ceiling.",
        ),
        {
          type: 'win',
          kind: 'edit',
          path: 'src/middleware/session.ts',
          tag: '+9 −3',
          summary: 'Rewrote the idle check as a rolling window',
          diff: `   const claims = verify(token, SECRET);
-  const IDLE_MS = 15 * 60 * 1000;
-  if (Date.now() - claims.iat * 1000 > IDLE_MS) {
-    return reject(res, "session_expired");
-  }
+  const IDLE_MS = 30 * 60 * 1000;
+  const lastSeen = await store.get(\`seen:\${claims.sub}\`);
+  const idle = lastSeen ? Date.now() - Number(lastSeen) : 0;
+  if (idle > IDLE_MS) return reject(res, "idle_timeout");
+  if (Date.now() > claims.exp * 1000) return reject(res, "expired");
+  await store.set(\`seen:\${claims.sub}\`, Date.now(), "EX", 3600);
   return claims;`,
        },
        P(
          'I also added a test that fast-forwards the clock 20 minutes with steady activity and asserts the session survives. Want me to run the suite?',
        ),
      ),
      U(P('Yes, run it.')),
      A(
        'Sonnet',
        CODE(
          'shell',
          `$ pnpm test session

 ✓ src/middleware/session.test.ts (24 tests)
   ✓ rejects a request with no token
   ✓ rejects after 30m of inactivity
   ✓ survives 20m with steady activity        ← new
   ✓ honors the token's exp as the ceiling
   …18 more

 Test Files  1 passed (1)
      Tests  24 passed (24)
   Duration  1.42s`,
        ),
        P(
          'All 24 session tests pass, including the new rolling-window case. The fix is ready on `feat/session-store` whenever you want to open the PR.',
        ),
      ),
    ],
  },
  {
    id: uid(),
    name: 'marketing-site copy',
    model: 'claude-opus-4-6',
    systemPrompt: '',
    path: '~/dev/acme/marketing-site',
    branch: 'main',
    createdAt: NOW - 3 * HOUR,
    lastActiveAt: NOW - 1 * HOUR,
    tokens: 31_650,
    usage: splitUsage(31_650),
    sdkSessionId: '',
    turns: [
      U(
        P(
          'Rewrite the homepage hero. Right now it says "The all-in-one platform for modern teams." It\'s generic. We sell incident-response tooling for on-call engineers.',
        ),
      ),
      A(
        'Opus',
        P(
          'Generic is the enemy here — "all-in-one platform for modern teams" could sell anything. Let me anchor it to the specific pain your buyer feels at 3am.',
        ),
        H('Three directions'),
        UL(
          '**Stop guessing at 3am.** — Incident response that tells your on-call engineer what broke, where, and what to do next.',
          "**The pager goes off. Now what?** — From alert to root cause in one screen, before your coffee's done.",
          "**On-call shouldn't mean on-edge.** — Context, runbooks, and the right teammate, surfaced the moment an alert fires.",
        ),
        P(
          'My pick is the first — it leads with the emotional moment (3am) and immediately pays it off with concrete capability. Want me to draft the supporting subhead and CTA for it?',
        ),
      ),
    ],
  },
  {
    id: uid(),
    name: 'data-pipeline debug',
    model: 'claude-haiku-4-5',
    systemPrompt: '',
    path: '~/dev/internal/data-pipelines',
    branch: 'fix/null-rows',
    createdAt: NOW - 2 * DAY,
    lastActiveAt: NOW - 1 * DAY,
    tokens: 12_400,
    usage: splitUsage(12_400),
    sdkSessionId: '',
    turns: [
      U(
        P(
          'The nightly ETL job is dropping ~3% of rows silently. No errors in the logs.',
        ),
      ),
      A(
        'Haiku',
        P(
          "Silent drops usually mean a filter or a failed cast that's being swallowed. Let me check the transform step.",
        ),
        {
          type: 'win',
          kind: 'read',
          path: 'jobs/nightly/transform.py',
          tag: '120 lines',
          summary: 'Read the transform step',
          lang: 'python',
          code: `def transform(df):
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df = df.dropna(subset=["amount"])    # drops un-parseable rows
    df["ts"] = pd.to_datetime(df["ts"])
    return df`,
        },
        P(
          'Here it is — `pd.to_numeric(..., errors="coerce")` turns un-parseable values into `NaN`, and the next line drops every `NaN` row. So any record with a malformed amount disappears without a trace.',
        ),
        P(
          'Quickest safe fix: route the un-parseable rows to a quarantine table instead of dropping them, and log the count. Want me to wire that up?',
        ),
      ),
    ],
  },
];

/** Which seed sessions are "open" (have a tab) on first run. */
export const SEED_OPEN_IDS = [SEED_SESSIONS[0]!.id, SEED_SESSIONS[1]!.id];
