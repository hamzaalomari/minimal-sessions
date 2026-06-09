import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useApplyTweaks, useTweaks } from './tweaks';

function resetStore() {
  useTweaks.setState({
    theme: 'light',
    accent: '#c4663f',
    readFont: 'sans',
    density: 'cozy',
  });
}

describe('useTweaks store', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it('has the documented defaults', () => {
    const s = useTweaks.getState();
    expect(s.theme).toBe('light');
    expect(s.accent).toBe('#c4663f');
    expect(s.readFont).toBe('sans');
    expect(s.density).toBe('cozy');
  });

  it('setters mutate the corresponding field', () => {
    const s = useTweaks.getState();
    act(() => s.setTheme('dark'));
    expect(useTweaks.getState().theme).toBe('dark');

    act(() => s.setAccent('#abcdef'));
    expect(useTweaks.getState().accent).toBe('#abcdef');

    act(() => s.setReadFont('serif'));
    expect(useTweaks.getState().readFont).toBe('serif');

    act(() => s.setDensity('compact'));
    expect(useTweaks.getState().density).toBe('compact');
  });

  it('toggleTheme flips light ↔ dark', () => {
    const { toggleTheme } = useTweaks.getState();
    expect(useTweaks.getState().theme).toBe('light');
    act(() => toggleTheme());
    expect(useTweaks.getState().theme).toBe('dark');
    act(() => toggleTheme());
    expect(useTweaks.getState().theme).toBe('light');
  });

  it('persists changes to localStorage under the "tweaks" key', () => {
    act(() => useTweaks.getState().setTheme('dark'));
    const raw = localStorage.getItem('tweaks');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.theme).toBe('dark');
  });
});

describe('useApplyTweaks', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
    document.body.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
  });

  it('writes the current theme to body[data-theme]', () => {
    renderHook(() => useApplyTweaks());
    expect(document.body.getAttribute('data-theme')).toBe('light');

    act(() => useTweaks.getState().setTheme('dark'));
    expect(document.body.getAttribute('data-theme')).toBe('dark');
  });

  it('writes accent + read-font + density tokens to :root', () => {
    renderHook(() => useApplyTweaks());
    const r = document.documentElement.style;

    expect(r.getPropertyValue('--accent')).toBe('#c4663f');
    expect(r.getPropertyValue('--read')).toBe('var(--ui)');
    expect(r.getPropertyValue('--turn-gap')).toBe('32px');
    expect(r.getPropertyValue('--read-line')).toBe('1.68');
  });

  it('serif font swaps --read to var(--serif) and bumps --read-size', () => {
    renderHook(() => useApplyTweaks());
    act(() => useTweaks.getState().setReadFont('serif'));
    const r = document.documentElement.style;
    expect(r.getPropertyValue('--read')).toBe('var(--serif)');
    expect(r.getPropertyValue('--read-size')).toBe('16.5px');
  });

  it('compact density tightens gap, size, and line-height', () => {
    renderHook(() => useApplyTweaks());
    act(() => useTweaks.getState().setDensity('compact'));
    const r = document.documentElement.style;
    expect(r.getPropertyValue('--turn-gap')).toBe('22px');
    expect(r.getPropertyValue('--read-size')).toBe('15px');
    expect(r.getPropertyValue('--read-line')).toBe('1.55');
  });
});
