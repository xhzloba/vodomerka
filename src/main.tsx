import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyAppTheme, normalizeAppTheme } from './shared/settings/themes';
import './styles/globals.css';
import './shared/ui/scroll.css';
import './shared/ui/icons/icons.css';

try {
  const raw = localStorage.getItem('tv-leonid-settings');
  if (raw) {
    const parsed = JSON.parse(raw) as { theme?: unknown };
    applyAppTheme(normalizeAppTheme(parsed.theme));
  } else {
    applyAppTheme('obsidian');
  }
} catch {
  applyAppTheme('obsidian');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
