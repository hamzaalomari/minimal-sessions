import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement ResizeObserver — components like Transcript that
// observe content height use it for sticky-bottom autoscroll. Stub it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    constructor(_cb: (...args: unknown[]) => void) {
      void _cb;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

afterEach(() => {
  cleanup();
  document.body.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
  localStorage.clear();
});
