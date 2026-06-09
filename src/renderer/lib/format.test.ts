import { describe, expect, it } from 'vitest';
import { fmtRelativeTime, fmtTokens } from './format';

describe('fmtTokens', () => {
  it.each([
    [0, '0'],
    [42, '42'],
    [999, '999'],
    [1000, '1.0K'],
    [1500, '1.5K'],
    [9999, '10.0K'],
    [10_000, '10K'],
    [48_200, '48K'],
    [200_000, '200K'],
  ])('%i → %s', (input, expected) => {
    expect(fmtTokens(input)).toBe(expected);
  });
});

describe('fmtRelativeTime', () => {
  const NOW = new Date('2026-06-09T12:00:00Z').getTime();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('returns "now" within the last minute', () => {
    expect(fmtRelativeTime(NOW - 30_000, NOW)).toBe('now');
  });

  it('returns minutes for the past hour', () => {
    expect(fmtRelativeTime(NOW - 5 * MIN, NOW)).toBe('5m');
    expect(fmtRelativeTime(NOW - 59 * MIN, NOW)).toBe('59m');
  });

  it('returns hours for the past day', () => {
    expect(fmtRelativeTime(NOW - 1 * HOUR, NOW)).toBe('1h');
    expect(fmtRelativeTime(NOW - 23 * HOUR, NOW)).toBe('23h');
  });

  it('returns "yesterday" between 1 and 2 days', () => {
    expect(fmtRelativeTime(NOW - 1.5 * DAY, NOW)).toBe('yesterday');
  });

  it('returns days for the past week', () => {
    expect(fmtRelativeTime(NOW - 3 * DAY, NOW)).toBe('3d');
    expect(fmtRelativeTime(NOW - 6 * DAY, NOW)).toBe('6d');
  });

  it('falls back to a date string past 7 days', () => {
    expect(fmtRelativeTime(NOW - 10 * DAY, NOW)).toMatch(/\d/);
  });

  it('treats future timestamps as "now"', () => {
    expect(fmtRelativeTime(NOW + 5 * MIN, NOW)).toBe('now');
  });
});
