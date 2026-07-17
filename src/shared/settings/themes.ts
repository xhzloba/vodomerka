import {
  BUILTIN_THEME_IDS,
  DEFAULT_THEME_ID,
  type AppTheme,
  type BuiltinThemeId,
  type InstalledThemePlugin,
} from '../../../contracts/ipc';

export type { AppTheme, BuiltinThemeId };

export const DEFAULT_APP_THEME: AppTheme = DEFAULT_THEME_ID;

export const APP_THEME_OPTIONS: Array<{
  id: BuiltinThemeId;
  label: string;
  description: string;
  preview: { bg: string; accent: string };
}> = [
  {
    id: 'obsidian',
    label: 'Обсидиан',
    description: 'Тёплый графитовый фон с серебристым свечением',
    preview: { bg: '#0a0a0e', accent: '#c8ced8' },
  },
];

const BUILTIN_THEME_BACKGROUNDS: Record<BuiltinThemeId, string> = {
  obsidian: '#0a0a0e',
};

const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const PLUGIN_STYLE_ID = 'vodomerka-plugin-theme';

export function isBuiltinTheme(value: unknown): value is BuiltinThemeId {
  return typeof value === 'string' && (BUILTIN_THEME_IDS as readonly string[]).includes(value);
}

export function isAppThemeId(value: unknown): value is AppTheme {
  return typeof value === 'string' && THEME_ID_PATTERN.test(value);
}

export function normalizeAppTheme(value: unknown): AppTheme {
  return isAppThemeId(value) ? value : DEFAULT_APP_THEME;
}

export function getThemeBackgroundColor(theme: AppTheme): string {
  if (isBuiltinTheme(theme)) {
    return BUILTIN_THEME_BACKGROUNDS[theme];
  }

  return BUILTIN_THEME_BACKGROUNDS.obsidian;
}

export function buildScopedThemeCss(themeId: string, css: string): string {
  const trimmed = css.trim();
  if (
    trimmed.includes(`[data-theme='${themeId}']`) ||
    trimmed.includes(`[data-theme="${themeId}"]`)
  ) {
    return trimmed;
  }

  return `[data-theme='${themeId}'] {\n${trimmed}\n}`;
}

export function clearPluginThemeStyles(): void {
  document.getElementById(PLUGIN_STYLE_ID)?.remove();
}

export function applyAppTheme(theme: AppTheme, pluginCss?: string | null): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = 'dark';

  if (isBuiltinTheme(theme) || !pluginCss) {
    clearPluginThemeStyles();
    return;
  }

  let style = document.getElementById(PLUGIN_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = PLUGIN_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = buildScopedThemeCss(theme, pluginCss);
}

export async function resolveThemeCss(theme: AppTheme): Promise<string | null> {
  if (isBuiltinTheme(theme)) {
    return null;
  }

  if (window.electronAPI?.plugins) {
    const installed = await window.electronAPI.plugins.getTheme(theme);
    return installed?.css ?? null;
  }

  const local = readLocalInstalledThemes().find((item) => item.id === theme);
  return local?.css ?? null;
}

export async function applyResolvedTheme(theme: AppTheme): Promise<void> {
  const css = await resolveThemeCss(theme);
  if (!isBuiltinTheme(theme) && !css) {
    applyAppTheme(DEFAULT_APP_THEME);
    return;
  }

  applyAppTheme(theme, css);
}

const LOCAL_THEMES_KEY = 'tv-leonid-plugin-themes';

export function readLocalInstalledThemes(): InstalledThemePlugin[] {
  try {
    const raw = localStorage.getItem(LOCAL_THEMES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is InstalledThemePlugin => {
      return (
        !!item &&
        typeof item === 'object' &&
        typeof (item as InstalledThemePlugin).id === 'string' &&
        typeof (item as InstalledThemePlugin).css === 'string'
      );
    });
  } catch {
    return [];
  }
}

export function writeLocalInstalledThemes(themes: InstalledThemePlugin[]): void {
  localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(themes));
}
