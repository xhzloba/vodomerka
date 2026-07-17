/** Theme plugin schema version. Bump when CSS token contract changes. */
export const THEME_PLUGIN_ENGINE = 1;

export const DEFAULT_THEME_ID = 'obsidian';

export const BUILTIN_THEME_IDS = ['obsidian'] as const;

export type BuiltinThemeId = (typeof BUILTIN_THEME_IDS)[number];

/** Any theme id: builtin or installed plugin. */
export type AppTheme = string;

export interface ThemePreviewSwatch {
  bg: string;
  accent: string;
}

export interface ThemePluginPackage {
  id: string;
  name: string;
  description: string;
  version: string;
  engine: number;
  windowBackground: string;
  preview: ThemePreviewSwatch;
  /** CSS custom properties body (or full [data-theme] block). */
  css: string;
}

export interface ThemeCatalogEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  url: string;
  localPath?: string;
  preview: ThemePreviewSwatch;
  windowBackground: string;
}

export interface ThemeCatalog {
  engine: number;
  updatedAt?: string;
  themes: ThemeCatalogEntry[];
}

export interface InstalledThemePlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  engine: number;
  windowBackground: string;
  preview: ThemePreviewSwatch;
  css: string;
  installedAt: number;
  sourceUrl?: string;
}

export type PluginResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
