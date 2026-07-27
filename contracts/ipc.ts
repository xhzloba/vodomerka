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

export type CollectionLayout = 'slider' | 'grid';

/** Mutually exclusive watch statuses (favorites stay separate). */
export type WatchStatus = 'watching' | 'watched' | 'postponed' | 'dropped';

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
  /** Collection / watch-status list layout. */
  collectionLayout: CollectionLayout;
  sidebarCollapsed: boolean;
  sidebarMenuAnimation: SidebarMenuAnimation;
  sidebarStyle: SidebarStyle;
  hiddenHomeSections: HiddenHomeSection[];
  hiddenMediatekaItemIds: string[];
  homeSectionRestoreOrder: string[];
  homeFavoritesSection: HomeSectionMode;
  homeRecentlyViewedSection: HomeSectionMode;
  homeContinueWatchingSection: HomeSectionMode;
  setupWelcomeDismissed: boolean;
  browseCategoryHintDismissed: boolean;
  autoTipsEnabled: boolean;
  uiSoundsEnabled: boolean;
  dismissedTipIds: string[];
  tipShownAt: Record<string, number>;
  apiServer: ApiServerId;
  /** Preferred player for torrent playback: `vodomerka` | `system` | app id */
  torrentPlaybackPlayerId: string;
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

export interface WatchStatusRecord {
  item: StoredMediaItem;
  status: WatchStatus;
}

export interface ContinueWatchingRecord {
  id: string;
  mediaId: string;
  item: StoredMediaItem;
  torrentId?: string;
  filePath?: string;
  positionSeconds: number;
  durationSeconds?: number;
  updatedAt: number;
}

export interface ContinueWatchingUpsertPayload {
  mediaId?: string;
  item: StoredMediaItem;
  torrentId?: string;
  filePath?: string;
  positionSeconds: number;
  durationSeconds?: number;
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
  continueWatching: {
    list: 'continueWatching:list',
    upsert: 'continueWatching:upsert',
    remove: 'continueWatching:remove',
    clear: 'continueWatching:clear',
    changed: 'continueWatching:changed',
  },
  watched: {
    list: 'watched:list',
    setStatus: 'watched:setStatus',
    remove: 'watched:remove',
    getStatus: 'watched:getStatus',
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
    setFullScreen: 'windowChrome:setFullScreen',
    focusMain: 'windowChrome:focusMain',
    setPlayerOpen: 'windowChrome:setPlayerOpen',
    closePlayer: 'windowChrome:closePlayer',
    fullScreenChanged: 'windowChrome:fullScreenChanged',
  },
  system: {
    getUserDisplayName: 'system:getUserDisplayName',
    openExternal: 'system:openExternal',
    listMediaPlayers: 'system:listMediaPlayers',
  },
  torrents: {
    list: 'torrents:list',
    add: 'torrents:add',
    remove: 'torrents:remove',
    pause: 'torrents:pause',
    resume: 'torrents:resume',
    openFile: 'torrents:openFile',
    openInPlayer: 'torrents:openInPlayer',
    openFolder: 'torrents:openFolder',
    getFolderPath: 'torrents:getFolderPath',
    probeConnectivity: 'torrents:probeConnectivity',
    setMediaType: 'torrents:setMediaType',
    changed: 'torrents:changed',
  },
  media: {
    prepareTorrentPlayback: 'media:prepareTorrentPlayback',
    stopPlayback: 'media:stopPlayback',
  },
  detail: {
    tryFocus: 'detail:tryFocus',
    open: 'detail:open',
    get: 'detail:get',
    close: 'detail:close',
    ready: 'detail:ready',
  },
  player: {
    openTorrent: 'player:openTorrent',
    get: 'player:get',
    close: 'player:close',
    ready: 'player:ready',
    session: 'player:session',
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

export type OpenExternalResult =
  | { ok: true; via?: string }
  | { ok: false; error: string };

export type TorrentDownloadStatus =
  | 'queued'
  | 'downloading'
  | 'done'
  | 'error'
  | 'paused';

export interface TorrentDownloadFile {
  name: string;
  path: string;
  length: number;
  /** 0..1 per-file download progress (WebTorrent). */
  progress?: number;
}

export interface TorrentDownloadRecord {
  id: string;
  magnet: string;
  title: string;
  mediaId?: string;
  mediaTitle?: string;
  /** Vokino media type: movie | serial | multfilm | multserial | anime */
  mediaType?: string;
  posterUrl?: string;
  quality?: number | null;
  sizeName?: string;
  trackerName?: string;
  status: TorrentDownloadStatus;
  progress: number;
  downloadSpeed: number;
  uploaded: number;
  downloaded: number;
  length: number;
  /** Live WebTorrent swarm peers (not catalog seeds). */
  peers?: number;
  savePath: string;
  error?: string;
  files: TorrentDownloadFile[];
  addedAt: number;
  updatedAt: number;
}

export interface TorrentConnectivityTrackerResult {
  url: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface TorrentConnectivityProbeResult {
  ok: boolean;
  checkedAt: number;
  dnsOk: boolean;
  trackersOk: number;
  trackersTotal: number;
  trackers: TorrentConnectivityTrackerResult[];
  message: string;
}

export interface TorrentAddPayload {
  magnet: string;
  title: string;
  mediaId?: string;
  mediaTitle?: string;
  /** Vokino media type: movie | serial | multfilm | multserial | anime */
  mediaType?: string;
  posterUrl?: string;
  quality?: number | null;
  sizeName?: string;
  trackerName?: string;
}

export type TorrentAddResult =
  | { ok: true; torrent: TorrentDownloadRecord }
  | { ok: false; error: string };

export interface MediaPlaybackSession {
  torrentId: string;
  title: string;
  posterUrl?: string;
  /** Catalog / detail media id when known (manual magnets may omit). */
  mediaId?: string;
  url: string;
  filePath: string;
  sourcePath: string;
  remuxed: boolean;
  /** True while torrent is still downloading / live remux stream. */
  live?: boolean;
  seekable?: boolean;
  /** Probed duration for streams without native media duration (fMP4 remux). */
  durationSeconds?: number;
  /** Seek by restarting the remux at ?t=seconds (complete files on disk). */
  serverSeek?: boolean;
  /** Resume position applied once after metadata loads. */
  startSeconds?: number;
}

export type MediaPreparePlaybackResult =
  | { ok: true; session: MediaPlaybackSession }
  | { ok: false; error: string };

export interface PlayerOpenTorrentPayload {
  torrentId: string;
  filePath?: string;
  startSeconds?: number;
}

export type PlayerOpenTorrentResult =
  | { ok: true }
  | { ok: false; error: string };

export interface MediaPlayerOption {
  id: string;
  name: string;
  kind: 'builtin' | 'app' | 'system';
  installed: boolean;
  appPath?: string;
}

export type OpenInPlayerResult =
  | { ok: true; action: 'native' | 'external' }
  | { ok: false; error: string };

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
  continueWatching: {
    list: () => Promise<ContinueWatchingRecord[]>;
    upsert: (payload: ContinueWatchingUpsertPayload) => Promise<ContinueWatchingRecord[]>;
    remove: (id: string) => Promise<ContinueWatchingRecord[]>;
    clear: () => Promise<ContinueWatchingRecord[]>;
    onChanged: (callback: () => void) => Unsubscribe;
  };
  watched: {
    list: () => Promise<WatchStatusRecord[]>;
    setStatus: (item: StoredMediaItem, status: WatchStatus) => Promise<WatchStatusRecord[]>;
    remove: (mediaId: string) => Promise<WatchStatusRecord[]>;
    getStatus: (mediaId: string) => Promise<WatchStatus | null>;
    clear: (status?: WatchStatus) => Promise<WatchStatusRecord[]>;
    onChanged: (callback: () => void) => Unsubscribe;
  };
  torrents: {
    list: () => Promise<TorrentDownloadRecord[]>;
    add: (payload: TorrentAddPayload) => Promise<TorrentAddResult>;
    remove: (id: string, deleteFiles?: boolean) => Promise<TorrentDownloadRecord[]>;
    pause: (id: string) => Promise<TorrentDownloadRecord[]>;
    resume: (id: string) => Promise<TorrentDownloadRecord[]>;
    openFile: (id: string, filePath?: string) => Promise<{ ok: boolean; error?: string }>;
    openInPlayer: (
      id: string,
      playerId: string,
      filePath?: string,
    ) => Promise<OpenInPlayerResult>;
    openFolder: () => Promise<{ ok: boolean; error?: string }>;
    getFolderPath: () => Promise<string>;
    probeConnectivity: () => Promise<TorrentConnectivityProbeResult>;
    setMediaType: (id: string, mediaType: string) => Promise<TorrentDownloadRecord[]>;
    onChanged: (callback: (items: TorrentDownloadRecord[]) => void) => Unsubscribe;
  };
  media: {
    prepareTorrentPlayback: (
      torrentId: string,
      filePath?: string,
    ) => Promise<MediaPreparePlaybackResult>;
    stopPlayback: () => Promise<void>;
  };
  sidebar: {
    onToggle: (callback: () => void) => Unsubscribe;
  };
  search: {
    onToggle: (callback: () => void) => Unsubscribe;
  };
  windowChrome: {
    setSidebarCollapsed: (collapsed: boolean) => Promise<void>;
    setFullScreen: (fullScreen: boolean) => Promise<boolean>;
    focusMain: () => Promise<void>;
    setPlayerOpen: (open: boolean) => Promise<void>;
    onClosePlayer: (callback: () => void) => Unsubscribe;
    onFullScreenChanged: (callback: (fullScreen: boolean) => void) => Unsubscribe;
  };
  system: {
    getUserDisplayName: () => Promise<string | null>;
    openExternal: (url: string) => Promise<OpenExternalResult>;
    listMediaPlayers: () => Promise<MediaPlayerOption[]>;
  };
  detail: {
    tryFocus: (mediaId: string) => Promise<boolean>;
    open: (item: StoredMediaItem) => Promise<void>;
    get: (mediaId: string) => Promise<StoredMediaItem | null>;
    close: () => Promise<void>;
    notifyReady: (mediaId: string) => void;
    onReady: (callback: () => void) => Unsubscribe;
  };
  player: {
    openTorrent: (payload: PlayerOpenTorrentPayload) => Promise<PlayerOpenTorrentResult>;
    get: () => Promise<MediaPlaybackSession | null>;
    close: () => Promise<void>;
    notifyReady: () => void;
    onReady: (callback: () => void) => Unsubscribe;
    onSession: (callback: (session: MediaPlaybackSession) => void) => Unsubscribe;
  };
}
