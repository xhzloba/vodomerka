import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyAppTheme, normalizeAppTheme } from './shared/settings/themes';
import { applyPosterSizeCssVars, normalizePosterSize } from './shared/settings/types';
import './styles/globals.css';
import './shared/ui/scroll.css';
import './shared/ui/icons/icons.css';

try {
  const raw = localStorage.getItem('tv-leonid-settings');
  if (raw) {
    const parsed = JSON.parse(raw) as { theme?: unknown; posterSize?: unknown };
    applyAppTheme(normalizeAppTheme(parsed.theme));
    applyPosterSizeCssVars(normalizePosterSize(parsed.posterSize));
  } else {
    applyAppTheme('obsidian');
    applyPosterSizeCssVars('medium');
  }
} catch {
  applyAppTheme('obsidian');
  applyPosterSizeCssVars('medium');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
