/** Theme plugin schema version. Bump when CSS token contract changes. */
export const THEME_PLUGIN_ENGINE = 1;

export const DEFAULT_THEME_ID = 'obsidian';

export const BUILTIN_THEME_IDS = ['obsidian', 'pearl'] as const;

export type BuiltinThemeId = (typeof BUILTIN_THEME_IDS)[number];

/** Built-in themes that use light color-scheme. */
export const LIGHT_BUILTIN_THEME_IDS = ['pearl'] as const;

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

export type SidebarAnimationBehavior =
  | 'liquid'
  | 'snake'
  | 'magnetic'
  | 'magnetic-water'
  | 'edge-pulse';

export const DEFAULT_SIDEBAR_ANIMATION_ID = 'magnetic-water';

export const BUILTIN_SIDEBAR_ANIMATION_IDS = ['magnetic-water'] as const;

export type BuiltinSidebarAnimationId = (typeof BUILTIN_SIDEBAR_ANIMATION_IDS)[number];

/** Selected sidebar animation id: builtin or installed plugin. */
export type SidebarMenuAnimation = string;

export interface SidebarAnimationPluginPackage {
  id: string;
  name: string;
  description: string;
  version: string;
  engine: number;
  kind: 'sidebar-animation';
  behavior: SidebarAnimationBehavior;
  preview: ThemePreviewSwatch;
}

export interface SidebarAnimationCatalogEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  url: string;
  localPath?: string;
  preview: ThemePreviewSwatch;
  behavior: SidebarAnimationBehavior;
}

export interface InstalledSidebarAnimationPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  engine: number;
  kind: 'sidebar-animation';
  behavior: SidebarAnimationBehavior;
  preview: ThemePreviewSwatch;
  installedAt: number;
  sourceUrl?: string;
}

export interface ThemeCatalog {
  engine: number;
  updatedAt?: string;
  themes: ThemeCatalogEntry[];
  sidebarAnimations?: SidebarAnimationCatalogEntry[];
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
