import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  document.body.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
  localStorage.clear();
});
