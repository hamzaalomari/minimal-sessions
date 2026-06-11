import { describe, expect, it } from 'vitest';
import {
  costFor,
  formatTokens,
  formatUSD,
  pricingFor,
  totalTokens,
} from './pricing';

describe('pricingFor', () => {
  it('matches opus, sonnet, haiku by substring', () => {
    expect(pricingFor('claude-opus-4-6').label).toBe('Opus');
    expect(pricingFor('claude-sonnet-4-6').label).toBe('Sonnet');
    expect(pricingFor('claude-haiku-4-5').label).toBe('Haiku');
  });

  it('falls back when the model id is unknown or empty', () => {
    expect(pricingFor('something-else').inputPerMTok).toBeGreaterThan(0);
    expect(pricingFor(undefined).inputPerMTok).toBeGreaterThan(0);
    expect(pricingFor('').inputPerMTok).toBeGreaterThan(0);
  });
});

describe('costFor', () => {
  it('applies $/1M rates to plain input/output', () => {
    // Sonnet: 3 input, 15 output per 1M
    const c = costFor(
      { input: 1_000_000, output: 1_000_000, cacheCreation: 0, cacheRead: 0 },
      'claude-sonnet-4-6',
    );
    expect(c.input).toBeCloseTo(3, 6);
    expect(c.output).toBeCloseTo(15, 6);
    expect(c.cacheCreation).toBe(0);
    expect(c.cacheRead).toBe(0);
    expect(c.total).toBeCloseTo(18, 6);
  });

  it('marks up cache writes at 1.25× input', () => {
    const c = costFor(
      { input: 0, output: 0, cacheCreation: 1_000_000, cacheRead: 0 },
      'claude-sonnet-4-6',
    );
    expect(c.cacheCreation).toBeCloseTo(3 * 1.25, 6);
  });

  it('discounts cache reads at 0.1× input', () => {
    const c = costFor(
      { input: 0, output: 0, cacheCreation: 0, cacheRead: 1_000_000 },
      'claude-sonnet-4-6',
    );
    expect(c.cacheRead).toBeCloseTo(3 * 0.1, 6);
  });
});

describe('totalTokens', () => {
  it('sums all categories', () => {
    expect(
      totalTokens({ input: 10, output: 20, cacheCreation: 30, cacheRead: 40 }),
    ).toBe(100);
  });
});

describe('formatTokens', () => {
  it('renders below 1k as a plain integer', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(999)).toBe('999');
  });

  it('renders thousands with one decimal under 10k, integer otherwise', () => {
    expect(formatTokens(1_500)).toBe('1.5K');
    expect(formatTokens(12_300)).toBe('12K');
  });

  it('renders millions', () => {
    expect(formatTokens(1_200_000)).toBe('1.20M');
    expect(formatTokens(12_000_000)).toBe('12.0M');
  });
});

describe('formatUSD', () => {
  it('uses 4 decimals for sub-cent values', () => {
    expect(formatUSD(0.0012)).toBe('$0.0012');
  });

  it('uses 3 decimals for sub-dollar values', () => {
    expect(formatUSD(0.45)).toBe('$0.450');
  });

  it('uses 2 decimals for dollar+ values', () => {
    expect(formatUSD(12.7)).toBe('$12.70');
  });

  it('renders zero as $0.00', () => {
    expect(formatUSD(0)).toBe('$0.00');
  });
});
