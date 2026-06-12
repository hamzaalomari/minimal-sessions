import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Self-hosted fonts — no Google Fonts at runtime. Vite bundles the woff2s.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/600.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/sidebar.css';
import './styles/transcript.css';
import './styles/composer.css';
import './styles/new-session.css';
import './styles/menus.css';
import './styles/terminal.css';
import '@xterm/xterm/css/xterm.css';

// Route every left-click on an http(s) anchor through window.open so
// Electron's main-process setWindowOpenHandler reliably catches it and
// hands the URL to the OS default browser. Without this delegate, some
// anchor clicks navigate the renderer window itself.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
  const target = e.target;
  if (!(target instanceof Element)) return;
  const a = target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href') ?? '';
  if (!/^https?:\/\//i.test(href)) return;
  e.preventDefault();
  window.open(href, '_blank', 'noopener,noreferrer');
});

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
