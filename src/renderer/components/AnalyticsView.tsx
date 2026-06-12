import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ModelId, Session, TokenUsage } from '@shared/types';
import { ZERO_USAGE } from '@shared/types';
import { costFor, formatTokens, formatUSD, totalTokens } from '@shared/pricing';
import { Icon } from './Icon';
import { getModel } from '../data/models';
import { useSessions } from '../state/sessions';

export type AnalyticsRange = 'all' | '30d' | '7d' | '24h';

const RANGE_OPTIONS: ReadonlyArray<{ id: AnalyticsRange; label: string }> = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function cutoffFor(range: AnalyticsRange): number {
  switch (range) {
    case '24h':
      return Date.now() - DAY_MS;
    case '7d':
      return Date.now() - 7 * DAY_MS;
    case '30d':
      return Date.now() - 30 * DAY_MS;
    case 'all':
      return 0;
  }
}

interface ModelRollup {
  modelId: ModelId;
  label: string;
  color: string;
  usage: TokenUsage;
  tokens: number;
  cost: number;
  sessions: number;
}

interface CategoryRow {
  label: string;
  tokens: number;
  cost: number;
}

interface Aggregate {
  totals: { tokens: number; cost: number; sessions: number; turns: number };
  byModel: ModelRollup[];
  byCategory: CategoryRow[];
  topSessions: Array<{ session: Session; tokens: number; cost: number }>;
}

function emptyAggregate(): Aggregate {
  return {
    totals: { tokens: 0, cost: 0, sessions: 0, turns: 0 },
    byModel: [],
    byCategory: [],
    topSessions: [],
  };
}

function addUsage(into: TokenUsage, add: TokenUsage): void {
  into.input += add.input;
  into.output += add.output;
  into.cacheCreation += add.cacheCreation;
  into.cacheRead += add.cacheRead;
}

/** Per-session usage selector — folds turns down to a TokenUsage either for
 *  the whole lifetime ("all") or for turns at or after `cutoff`.
 *
 *  Legacy turns (created before the per-turn usage migration shipped) carry
 *  no usage data of their own. To avoid the time-filtered view showing zeros
 *  for sessions that predate the migration, we compute the *legacy share* of
 *  each session's lifetime usage (session.usage minus what the per-turn rows
 *  account for) and attribute it to `lastActiveAt` as a proxy timestamp. So:
 *    - new turns count precisely by their own createdAt
 *    - legacy turns count as one lump at session.lastActiveAt
 *  Imperfect for hybrid sessions, but better than throwing data away. */
function usageForRange(
  s: Session,
  cutoff: number,
): { usage: TokenUsage; turns: number } {
  if (cutoff <= 0) {
    return { usage: { ...s.usage }, turns: s.turns.length };
  }
  const acc: TokenUsage = { ...ZERO_USAGE };
  const fromTrackedTurns: TokenUsage = { ...ZERO_USAGE };
  let turns = 0;
  for (const t of s.turns) {
    if (t.usage) addUsage(fromTrackedTurns, t.usage);
    if (t.createdAt < cutoff) continue;
    turns += 1;
    if (t.usage) addUsage(acc, t.usage);
  }
  // Whatever the per-turn rows don't account for must be legacy. Attribute it
  // to lastActiveAt — falls into the window if and only if the session has
  // been active inside the window.
  if (s.lastActiveAt >= cutoff) {
    const legacy: TokenUsage = {
      input: Math.max(0, s.usage.input - fromTrackedTurns.input),
      output: Math.max(0, s.usage.output - fromTrackedTurns.output),
      cacheCreation: Math.max(0, s.usage.cacheCreation - fromTrackedTurns.cacheCreation),
      cacheRead: Math.max(0, s.usage.cacheRead - fromTrackedTurns.cacheRead),
    };
    addUsage(acc, legacy);
  }
  return { usage: acc, turns };
}

function aggregate(sessions: Session[], range: AnalyticsRange): Aggregate {
  if (sessions.length === 0) return emptyAggregate();
  const cutoff = cutoffFor(range);

  const perModel = new Map<ModelId, ModelRollup>();
  const totals: TokenUsage = { ...ZERO_USAGE };
  let totalCost = 0;
  let totalTurns = 0;
  let activeSessions = 0;
  const perSession: Array<{ session: Session; tokens: number; cost: number }> = [];

  for (const s of sessions) {
    const { usage, turns } = usageForRange(s, cutoff);
    const tokens = totalTokens(usage);
    const cost = costFor(usage, s.model).total;
    // Skip sessions with no activity in the window from rollups, but still
    // count them in topSessions when "All" so an empty-usage session at the
    // bottom doesn't sneak in.
    if (range !== 'all' && tokens === 0 && turns === 0) continue;

    activeSessions += 1;
    addUsage(totals, usage);
    totalCost += cost;
    totalTurns += turns;
    perSession.push({ session: s, tokens, cost });

    const existing = perModel.get(s.model);
    if (existing) {
      addUsage(existing.usage, usage);
      existing.tokens = totalTokens(existing.usage);
      existing.cost += cost;
      existing.sessions += 1;
    } else {
      const info = getModel(s.model);
      perModel.set(s.model, {
        modelId: s.model,
        label: info?.short ?? s.model,
        color: info?.color ?? 'var(--faint)',
        usage: { ...usage },
        tokens,
        cost,
        sessions: 1,
      });
    }
  }

  const byModel = [...perModel.values()].sort((a, b) => b.cost - a.cost);

  // Per-category cost: derive from per-model usage since cache rates differ
  // by tier and a global merge would mis-price mixed-model totals.
  const catCost = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0 };
  for (const m of byModel) {
    const c = costFor(m.usage, m.modelId);
    catCost.input += c.input;
    catCost.output += c.output;
    catCost.cacheCreation += c.cacheCreation;
    catCost.cacheRead += c.cacheRead;
  }

  const byCategory: CategoryRow[] = [
    { label: 'Input', tokens: totals.input, cost: catCost.input },
    { label: 'Output', tokens: totals.output, cost: catCost.output },
    { label: 'Cache write', tokens: totals.cacheCreation, cost: catCost.cacheCreation },
    { label: 'Cache read', tokens: totals.cacheRead, cost: catCost.cacheRead },
  ];

  const topSessions = perSession
    .filter((x) => x.cost > 0 || x.tokens > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  return {
    totals: {
      tokens: totalTokens(totals),
      cost: totalCost,
      sessions: activeSessions,
      turns: totalTurns,
    },
    byModel,
    byCategory,
    topSessions,
  };
}

export function AnalyticsView() {
  const { sessions, setSidebarView, selectSession } = useSessions(
    useShallow((s) => ({
      sessions: s.sessions,
      setSidebarView: s.setSidebarView,
      selectSession: s.selectSession,
    })),
  );

  const [range, setRange] = useState<AnalyticsRange>('all');
  const agg = useMemo(() => aggregate(sessions, range), [sessions, range]);
  const empty = agg.totals.tokens === 0 && agg.totals.cost === 0;
  const isFiltered = range !== 'all';

  return (
    <aside className="sidebar analytics" aria-label="Analytics">
      <div className="sidebar-hd">
        <div className="side-title">
          <span>Analytics</span>
          <span className="side-count">{agg.totals.sessions}</span>
        </div>
        <div className="seg an-range" role="radiogroup" aria-label="Time range">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={range === o.id}
              className={range === o.id ? 'on' : ''}
              onClick={() => setRange(o.id)}
              data-testid={`an-range-${o.id}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          className="new-btn"
          onClick={() => setSidebarView('sessions')}
          title="Back to sessions"
        >
          <Icon name="chevR" />
          Sessions
        </button>
      </div>

      <div className="analytics-body scroll">
        {empty ? (
          <div className="side-empty">
            {isFiltered
              ? 'No sessions active in this window. Try a longer range.'
              : 'No usage yet. Start a session and send a message to see analytics here.'}
          </div>
        ) : (
          <>
            <div className="an-cards">
              <div className="an-card">
                <div className="an-card-label">Cost</div>
                <div className="an-card-value">{formatUSD(agg.totals.cost)}</div>
              </div>
              <div className="an-card">
                <div className="an-card-label">Tokens</div>
                <div className="an-card-value">{formatTokens(agg.totals.tokens)}</div>
              </div>
              <div className="an-card">
                <div className="an-card-label">Turns</div>
                <div className="an-card-value">{agg.totals.turns}</div>
              </div>
            </div>

            <div className="an-section">
              <div className="an-section-hd">By model</div>
              <div className="an-rows">
                {agg.byModel.map((m) => {
                  const pct =
                    agg.totals.cost > 0
                      ? (m.cost / agg.totals.cost) * 100
                      : (m.tokens / Math.max(1, agg.totals.tokens)) * 100;
                  return (
                    <div className="an-row" key={m.modelId}>
                      <div className="an-row-hd">
                        <span className="an-dot" style={{ background: m.color }} />
                        <span className="an-row-label">{m.label}</span>
                        <span className="an-row-sub">
                          {m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}
                        </span>
                        <span className="an-row-stats">
                          <span>{formatTokens(m.tokens)}</span>
                          <span className="an-cost">{formatUSD(m.cost)}</span>
                        </span>
                      </div>
                      <div className="an-bar" aria-hidden="true">
                        <div
                          className="an-bar-fill"
                          style={{ width: `${pct}%`, background: m.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="an-section">
              <div className="an-section-hd">By category</div>
              <table className="an-table">
                <tbody>
                  {agg.byCategory.map((c) => (
                    <tr key={c.label}>
                      <td className="an-cat">{c.label}</td>
                      <td className="an-num">{formatTokens(c.tokens)}</td>
                      <td className="an-num an-cost">{formatUSD(c.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {agg.topSessions.length > 0 && (
              <div className="an-section">
                <div className="an-section-hd">Top sessions</div>
                <div className="an-rows">
                  {agg.topSessions.map(({ session, tokens, cost }) => (
                    <button
                      key={session.id}
                      type="button"
                      className="an-session"
                      onClick={() => {
                        selectSession(session.id);
                        setSidebarView('sessions');
                      }}
                      title={`Open ${session.name}`}
                    >
                      <span className="an-row-label">{session.name}</span>
                      <span className="an-row-stats">
                        <span>{formatTokens(tokens)}</span>
                        <span className="an-cost">{formatUSD(cost)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isFiltered && (
              <div className="an-note">
                Turns from before this update are bucketed at each session&rsquo;s
                last-active time, since they have no per-turn timestamps. New
                turns are counted precisely going forward.
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
