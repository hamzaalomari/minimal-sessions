/**
 * Per-model pricing for the status-bar usage popover.
 *
 * Rates are $/1M tokens — quoted from Anthropic's public pricing page.
 * Cache writes are billed at ~1.25× the input rate, cache reads at ~0.1×.
 * These constants live in the renderer-shared layer because both the meter
 * and any future export need the same numbers.
 *
 * If the SDK reports a model id we don't recognise, the helpers fall back
 * to the Sonnet tier — same order of magnitude, never silently zero.
 */

import type { ModelId, TokenUsage } from './types';

export interface ModelPricing {
  /** Display label used in the popover when we want to show the tier. */
  label: string;
  /** Dollars per 1M input tokens. */
  inputPerMTok: number;
  /** Dollars per 1M output tokens. */
  outputPerMTok: number;
}

const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

/**
 * Known model families. Lookup is by substring match against the model id so
 * minor revisions (e.g. `claude-sonnet-4-6` vs `claude-sonnet-4-6-20260301`)
 * share a row.
 */
const TABLE: ReadonlyArray<{ match: RegExp; pricing: ModelPricing }> = [
  {
    match: /opus/i,
    pricing: { label: 'Opus', inputPerMTok: 15, outputPerMTok: 75 },
  },
  {
    match: /sonnet/i,
    pricing: { label: 'Sonnet', inputPerMTok: 3, outputPerMTok: 15 },
  },
  {
    match: /haiku/i,
    pricing: { label: 'Haiku', inputPerMTok: 1, outputPerMTok: 5 },
  },
];

const FALLBACK: ModelPricing = {
  label: 'estimate',
  inputPerMTok: 3,
  outputPerMTok: 15,
};

export function pricingFor(modelId: ModelId | undefined): ModelPricing {
  if (!modelId) return FALLBACK;
  for (const row of TABLE) {
    if (row.match.test(modelId)) return row.pricing;
  }
  return FALLBACK;
}

export interface CostBreakdown {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  total: number;
}

/** Apply the pricing table to a usage record. All values are USD. */
export function costFor(usage: TokenUsage, modelId: ModelId | undefined): CostBreakdown {
  const p = pricingFor(modelId);
  const input = (usage.input * p.inputPerMTok) / 1_000_000;
  const output = (usage.output * p.outputPerMTok) / 1_000_000;
  const cacheCreation =
    (usage.cacheCreation * p.inputPerMTok * CACHE_WRITE_MULT) / 1_000_000;
  const cacheRead =
    (usage.cacheRead * p.inputPerMTok * CACHE_READ_MULT) / 1_000_000;
  return {
    input,
    output,
    cacheCreation,
    cacheRead,
    total: input + output + cacheCreation + cacheRead,
  };
}

/** Sum of all categories — kept in sync with the legacy session.tokens field. */
export function totalTokens(usage: TokenUsage): number {
  return usage.input + usage.output + usage.cacheCreation + usage.cacheRead;
}

/** "12.3K" / "1.2M" — used everywhere a raw token count would be too long. */
export function formatTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1_000;
    return v < 10 ? `${v.toFixed(1)}K` : `${Math.round(v)}K`;
  }
  const v = n / 1_000_000;
  return v < 10 ? `${v.toFixed(2)}M` : `${v.toFixed(1)}M`;
}

/** Render a USD value with adaptive precision (more decimals for cheap turns). */
export function formatUSD(n: number): string {
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
