import type {
  AppTheme,
  InstalledSidebarAnimationPlugin,
  InstalledThemePlugin,
  PluginResult,
  SidebarMenuAnimation,
  ThemeCatalog,
} from './themes';

export type {
  AppTheme,
  BuiltinThemeId,
  BuiltinSidebarAnimationId,
  InstalledSidebarAnimationPlugin,
  InstalledThemePlugin,
  PluginResult,
  SidebarAnimationBehavior,
  SidebarAnimationCatalogEntry,
  SidebarAnimationPluginPackage,
  SidebarMenuAnimation,
  ThemeCatalog,
  ThemeCatalogEntry,
  ThemePluginPackage,
  ThemePreviewSwatch,
} from './themes';

export {
  BUILTIN_SIDEBAR_ANIMATION_IDS,
  BUILTIN_THEME_IDS,
  DEFAULT_SIDEBAR_ANIMATION_ID,
  DEFAULT_THEME_ID,
  LIGHT_BUILTIN_THEME_IDS,
  THEME_PLUGIN_ENGINE,
} from './themes';

export type CatalogRowGapPreset = 'compact' | 'normal' | 'relaxed' | 'spacious';

export type PosterSizePreset = 'small' | 'medium' | 'large';

export type HomeSectionMode = 'auto' | 'on' | 'off';

export type ApiServerId = '1' | '2';

export type SidebarStyle = 'default' | 'apple';

export interface HiddenHomeSection {
  id: string;
  title: string;
}

export interface AppSettings {
  theme: AppTheme;
  heroEnabled: boolean;
  heroAutoSlide: boolean;
  heroSlideIntervalSec: number;
  heroSourceSectionIds: string[];
  cardShowInfo: boolean;
  catalogRowGap: CatalogRowGapPreset;
  posterSize: PosterSizePreset;
  sidebarCollapsed: boolean;
  sidebarMenuAnimation: SidebarMenuAnimation;
  sidebarStyle: SidebarStyle;
  hiddenHomeSections: HiddenHomeSection[];
  hiddenMediatekaItemIds: string[];
  homeSectionRestoreOrder: string[];
  homeFavoritesSection: HomeSectionMode;
  homeRecentlyViewedSection: HomeSectionMode;
  setupWelcomeDismissed: boolean;
  browseCategoryHintDismissed: boolean;
  autoTipsEnabled: boolean;
  uiSoundsEnabled: boolean;
  dismissedTipIds: string[];
  tipShownAt: Record<string, number>;
  apiServer: ApiServerId;
}

export interface StoredMediaItem {
  id: string;
  title: string;
  subtitle?: string;
  year?: number;
  type: string;
  genres: string[];
  rating?: number;
  duration?: string;
  description?: string;
  poster: string;
  backdrop: string;
  logo?: string;
  viewUrl: string;
  country?: string;
  director?: string;
  age?: number;
}

export interface MediaOverride {
  about?: string;
  poster?: string;
  backdrop?: string;
  logo?: string;
}

export type MediaOverridesMap = Record<string, MediaOverride>;

export const IPC_CHANNELS = {
  api: {
    get: 'api:get',
  },
  images: {
    fetch: 'images:fetch',
  },
  overrides: {
    get: 'overrides:get',
    invalidate: 'overrides:invalidate',
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    reset: 'settings:reset',
  },
  backup: {
    export: 'backup:export',
    import: 'backup:import',
  },
  plugins: {
    listThemes: 'plugins:listThemes',
    getTheme: 'plugins:getTheme',
    installTheme: 'plugins:installTheme',
    uninstallTheme: 'plugins:uninstallTheme',
    listSidebarAnimations: 'plugins:listSidebarAnimations',
    getSidebarAnimation: 'plugins:getSidebarAnimation',
    installSidebarAnimation: 'plugins:installSidebarAnimation',
    uninstallSidebarAnimation: 'plugins:uninstallSidebarAnimation',
    fetchCatalog: 'plugins:fetchCatalog',
    installProgress: 'plugins:installProgress',
  },
  favorites: {
    list: 'favorites:list',
    add: 'favorites:add',
    remove: 'favorites:remove',
    has: 'favorites:has',
    clear: 'favorites:clear',
    changed: 'favorites:changed',
  },
  recentlyViewed: {
    list: 'recentlyViewed:list',
    track: 'recentlyViewed:track',
    clear: 'recentlyViewed:clear',
    changed: 'recentlyViewed:changed',
  },
  watched: {
    list: 'watched:list',
    add: 'watched:add',
    remove: 'watched:remove',
    has: 'watched:has',
    clear: 'watched:clear',
    changed: 'watched:changed',
  },
  sidebar: {
    toggle: 'sidebar:toggle',
  },
  search: {
    toggle: 'search:toggle',
  },
  windowChrome: {
    setSidebarCollapsed: 'windowChrome:setSidebarCollapsed',
  },
  system: {
    getUserDisplayName: 'system:getUserDisplayName',
  },
  detail: {
    tryFocus: 'detail:tryFocus',
    open: 'detail:open',
    get: 'detail:get',
    close: 'detail:close',
    ready: 'detail:ready',
  },
} as const;

export type Unsubscribe = () => void;

export type PluginInstallKind = 'theme' | 'sidebar';

export interface PluginInstallProgressEvent {
  id: string;
  kind: PluginInstallKind;
  progress: number;
}

export type BackupResult =
  | { ok: true; settings?: AppSettings }
  | { ok: false; cancelled?: true; error?: string };

export interface ElectronApi {
  platform: string;
  api: {
    get: (url: string) => Promise<unknown>;
  };
  images: {
    fetch: (url: string) => Promise<string>;
  };
  overrides: {
    get: () => Promise<MediaOverridesMap>;
    invalidate: () => Promise<void>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (patch: Partial<AppSettings>) => Promise<AppSettings>;
    reset: () => Promise<AppSettings>;
  };
  backup: {
    export: () => Promise<BackupResult>;
    import: () => Promise<BackupResult>;
  };
  plugins: {
    listThemes: () => Promise<InstalledThemePlugin[]>;
    getTheme: (id: string) => Promise<InstalledThemePlugin | null>;
    installTheme: (urlOrLocalId: string) => Promise<PluginResult<InstalledThemePlugin>>;
    uninstallTheme: (id: string) => Promise<PluginResult<{ removed: boolean }>>;
    listSidebarAnimations: () => Promise<InstalledSidebarAnimationPlugin[]>;
    getSidebarAnimation: (id: string) => Promise<InstalledSidebarAnimationPlugin | null>;
    installSidebarAnimation: (
      urlOrLocalId: string,
    ) => Promise<PluginResult<InstalledSidebarAnimationPlugin>>;
    uninstallSidebarAnimation: (id: string) => Promise<PluginResult<{ removed: boolean }>>;
    fetchCatalog: () => Promise<PluginResult<ThemeCatalog>>;
    onInstallProgress: (callback: (event: PluginInstallProgressEvent) => void) => Unsubscribe;
  };
  favorites: {
    list: () => Promise<StoredMediaItem[]>;
    add: (item: StoredMediaItem) => Promise<StoredMediaItem[]>;
    remove: (mediaId: string) => Promise<StoredMediaItem[]>;
    has: (mediaId: string) => Promise<boolean>;
    clear: () => Promise<StoredMediaItem[]>;
    onChanged: (callback: () => void) => Unsubscribe;
  };
  recentlyViewed: {
    list: () => Promise<StoredMediaItem[]>;
    track: (item: StoredMediaItem) => Promise<StoredMediaItem[]>;
    clear: () => Promise<StoredMediaItem[]>;
    onChanged: (callback: () => void) => Unsubscribe;
  };
  watched: {
    list: () => Promise<StoredMediaItem[]>;
    add: (item: StoredMediaItem) => Promise<StoredMediaItem[]>;
    remove: (mediaId: string) => Promise<StoredMediaItem[]>;
    has: (mediaId: string) => Promise<boolean>;
    clear: () => Promise<StoredMediaItem[]>;
    onChanged: (callback: () => void) => Unsubscribe;
  };
  sidebar: {
    onToggle: (callback: () => void) => Unsubscribe;
  };
  search: {
    onToggle: (callback: () => void) => Unsubscribe;
  };
  windowChrome: {
    setSidebarCollapsed: (collapsed: boolean) => Promise<void>;
  };
  system: {
    getUserDisplayName: () => Promise<string | null>;
  };
  detail: {
    tryFocus: (mediaId: string) => Promise<boolean>;
    open: (item: StoredMediaItem) => Promise<void>;
    get: (mediaId: string) => Promise<StoredMediaItem | null>;
    close: () => Promise<void>;
    notifyReady: (mediaId: string) => void;
    onReady: (callback: () => void) => Unsubscribe;
  };
}
