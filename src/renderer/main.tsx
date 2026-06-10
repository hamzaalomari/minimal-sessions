import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
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
