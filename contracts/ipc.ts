export type AppTheme = 'obsidian' | 'onyx' | 'nocturne' | 'ember' | 'aurora';

export type CatalogRowGapPreset = 'compact' | 'normal' | 'relaxed' | 'spacious';

export type PosterSizePreset = 'small' | 'medium' | 'large';

export type HomeSectionMode = 'auto' | 'on' | 'off';

export type SidebarMenuAnimation = 'liquid' | 'snake' | 'magnetic' | 'magnetic-water' | 'edge-pulse';

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
  hiddenHomeSections: HiddenHomeSection[];
  homeSectionRestoreOrder: string[];
  homeFavoritesSection: HomeSectionMode;
  homeRecentlyViewedSection: HomeSectionMode;
  setupWelcomeDismissed: boolean;
  browseCategoryHintDismissed: boolean;
  autoTipsEnabled: boolean;
  uiSoundsEnabled: boolean;
  dismissedTipIds: string[];
  tipShownAt: Record<string, number>;
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
