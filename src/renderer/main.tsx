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

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
