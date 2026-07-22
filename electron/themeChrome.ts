import { app, BrowserWindow, nativeTheme } from 'electron';
import { readFileSync } from 'fs';
import path from 'path';
import { LIGHT_BUILTIN_THEME_IDS } from '../contracts/themes';
import { getThemeBackgroundColor, type AppTheme } from './db/settings';

const LIGHT_BUILTIN = new Set<string>(LIGHT_BUILTIN_THEME_IDS);

export function isLightAppTheme(theme: AppTheme): boolean {
  if (LIGHT_BUILTIN.has(theme)) {
    return true;
  }

  try {
    const filePath = path.join(app.getPath('userData'), 'plugins', 'themes', `${theme}.json`);
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as { css?: unknown };
    return typeof parsed.css === 'string' && /color-scheme\s*:\s*light/i.test(parsed.css);
  } catch {
    return false;
  }
}

/** Sync OS window chrome + background so light themes don't get a dark hairline border. */
export function applyThemeWindowChrome(theme: AppTheme): void {
  const backgroundColor = getThemeBackgroundColor(theme);
  nativeTheme.themeSource = isLightAppTheme(theme) ? 'light' : 'dark';

  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) {
      continue;
    }
    win.setBackgroundColor(backgroundColor);
  }
}
