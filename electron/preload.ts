import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type AppSettings,
  type AiChatMessage,
  type AiChatResult,
  type AiDeleteResult,
  type AiInstalledModel,
  type AiPullProgressEvent,
  type AiPullResult,
  type AiStatusSnapshot,
  type BackupResult,
  type ElectronApi,
  type InstalledSidebarAnimationPlugin,
  type InstalledThemePlugin,
  type MediaPreparePlaybackResult,
  type MediaPlayerOption,
  type MediaOverridesMap,
  type OpenExternalResult,
  type OpenInPlayerResult,
  type PluginInstallProgressEvent,
  type PluginResult,
  type ContinueWatchingRecord,
  type ContinueWatchingUpsertPayload,
  type StoredMediaItem,
  type ThemeCatalog,
  type MediaPlaybackSession,
  type PlayerOpenTorrentPayload,
  type PlayerOpenTorrentResult,
  type TorrentAddPayload,
  type TorrentAddResult,
  type TorrentConnectivityProbeResult,
  type TorrentDownloadRecord,
  type WatchStatus,
  type WatchStatusRecord,
} from '../contracts/ipc';

const electronApi: ElectronApi = {
  platform: process.platform,
  api: {
    get: (url: string): Promise<unknown> => ipcRenderer.invoke(IPC_CHANNELS.api.get, url),
    resolveUrl: (url: string): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.api.resolveUrl, url),
    proxyHlsUrl: (url: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.api.proxyHlsUrl, url),
  },
  images: {
    fetch: (url: string): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.images.fetch, url),
  },
  overrides: {
    get: (): Promise<MediaOverridesMap> => ipcRenderer.invoke(IPC_CHANNELS.overrides.get),
    invalidate: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.overrides.invalidate),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.set, patch),
    reset: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.settings.reset),
  },
  backup: {
    export: (): Promise<BackupResult> => ipcRenderer.invoke(IPC_CHANNELS.backup.export),
    import: (): Promise<BackupResult> => ipcRenderer.invoke(IPC_CHANNELS.backup.import),
  },
  plugins: {
    listThemes: (): Promise<InstalledThemePlugin[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.listThemes),
    getTheme: (id: string): Promise<InstalledThemePlugin | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.getTheme, id),
    installTheme: (urlOrLocalId: string): Promise<PluginResult<InstalledThemePlugin>> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.installTheme, urlOrLocalId),
    uninstallTheme: (id: string): Promise<PluginResult<{ removed: boolean }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.uninstallTheme, id),
    listSidebarAnimations: (): Promise<InstalledSidebarAnimationPlugin[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.listSidebarAnimations),
    getSidebarAnimation: (id: string): Promise<InstalledSidebarAnimationPlugin | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.getSidebarAnimation, id),
    installSidebarAnimation: (
      urlOrLocalId: string,
    ): Promise<PluginResult<InstalledSidebarAnimationPlugin>> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.installSidebarAnimation, urlOrLocalId),
    uninstallSidebarAnimation: (id: string): Promise<PluginResult<{ removed: boolean }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.uninstallSidebarAnimation, id),
    fetchCatalog: (): Promise<PluginResult<ThemeCatalog>> =>
      ipcRenderer.invoke(IPC_CHANNELS.plugins.fetchCatalog),
    onInstallProgress: (callback: (event: PluginInstallProgressEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: PluginInstallProgressEvent) => {
        callback(payload);
      };
      ipcRenderer.on(IPC_CHANNELS.plugins.installProgress, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.plugins.installProgress, listener);
      };
    },
  },
  favorites: {
    list: (): Promise<StoredMediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.favorites.list),
    add: (item: StoredMediaItem): Promise<StoredMediaItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.favorites.add, item),
    remove: (mediaId: string): Promise<StoredMediaItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.favorites.remove, mediaId),
    has: (mediaId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.favorites.has, mediaId),
    clear: (): Promise<StoredMediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.favorites.clear),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.favorites.changed, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.favorites.changed, listener);
      };
    },
  },
  recentlyViewed: {
    list: (): Promise<StoredMediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.recentlyViewed.list),
    track: (item: StoredMediaItem): Promise<StoredMediaItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.recentlyViewed.track, item),
    clear: (): Promise<StoredMediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.recentlyViewed.clear),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.recentlyViewed.changed, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.recentlyViewed.changed, listener);
      };
    },
  },
  continueWatching: {
    list: (): Promise<ContinueWatchingRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.continueWatching.list),
    upsert: (payload: ContinueWatchingUpsertPayload): Promise<ContinueWatchingRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.continueWatching.upsert, payload),
    remove: (id: string): Promise<ContinueWatchingRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.continueWatching.remove, id),
    clear: (): Promise<ContinueWatchingRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.continueWatching.clear),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.continueWatching.changed, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.continueWatching.changed, listener);
      };
    },
  },
  watched: {
    list: (): Promise<WatchStatusRecord[]> => ipcRenderer.invoke(IPC_CHANNELS.watched.list),
    setStatus: (item: StoredMediaItem, status: WatchStatus): Promise<WatchStatusRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.watched.setStatus, item, status),
    remove: (mediaId: string): Promise<WatchStatusRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.watched.remove, mediaId),
    getStatus: (mediaId: string): Promise<WatchStatus | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.watched.getStatus, mediaId),
    clear: (status?: WatchStatus): Promise<WatchStatusRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.watched.clear, status),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.watched.changed, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.watched.changed, listener);
      };
    },
  },
  torrents: {
    list: (): Promise<TorrentDownloadRecord[]> => ipcRenderer.invoke(IPC_CHANNELS.torrents.list),
    add: (payload: TorrentAddPayload): Promise<TorrentAddResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.add, payload),
    remove: (id: string, deleteFiles?: boolean): Promise<TorrentDownloadRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.remove, id, deleteFiles),
    pause: (id: string): Promise<TorrentDownloadRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.pause, id),
    resume: (id: string): Promise<TorrentDownloadRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.resume, id),
    openFile: (id: string, filePath?: string): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.openFile, id, filePath),
    openInPlayer: (
      id: string,
      playerId: string,
      filePath?: string,
    ): Promise<OpenInPlayerResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.openInPlayer, id, playerId, filePath),
    openFolder: (): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.openFolder),
    getFolderPath: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.torrents.getFolderPath),
    probeConnectivity: (): Promise<TorrentConnectivityProbeResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.probeConnectivity),
    setMediaType: (id: string, mediaType: string): Promise<TorrentDownloadRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.setMediaType, id, mediaType),
    setPosterUrl: (id: string, posterUrl: string): Promise<TorrentDownloadRecord[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.torrents.setPosterUrl, id, posterUrl),
    onChanged: (callback: (items: TorrentDownloadRecord[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, items: TorrentDownloadRecord[]) => {
        callback(items);
      };
      ipcRenderer.on(IPC_CHANNELS.torrents.changed, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.torrents.changed, listener);
      };
    },
  },
  media: {
    prepareTorrentPlayback: (
      torrentId: string,
      filePath?: string,
    ): Promise<MediaPreparePlaybackResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.media.prepareTorrentPlayback, torrentId, filePath),
    stopPlayback: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.media.stopPlayback),
  },
  sidebar: {
    onToggle: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.sidebar.toggle, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.sidebar.toggle, listener);
      };
    },
  },
  search: {
    onToggle: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.search.toggle, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.search.toggle, listener);
      };
    },
  },
  windowChrome: {
    setSidebarCollapsed: (collapsed: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.windowChrome.setSidebarCollapsed, collapsed),
    setFullScreen: (fullScreen: boolean): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.windowChrome.setFullScreen, fullScreen),
    focusMain: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.windowChrome.focusMain),
    setPlayerOpen: (open: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.windowChrome.setPlayerOpen, open),
    onClosePlayer: (callback: () => void): (() => void) => {
      const listener = (): void => {
        callback();
      };
      ipcRenderer.on(IPC_CHANNELS.windowChrome.closePlayer, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.windowChrome.closePlayer, listener);
      };
    },
    onFullScreenChanged: (callback: (fullScreen: boolean) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, fullScreen: boolean): void => {
        callback(Boolean(fullScreen));
      };
      ipcRenderer.on(IPC_CHANNELS.windowChrome.fullScreenChanged, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.windowChrome.fullScreenChanged, listener);
      };
    },
  },
  system: {
    getUserDisplayName: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.system.getUserDisplayName),
    openExternal: (url: string): Promise<OpenExternalResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.system.openExternal, url),
    listMediaPlayers: (): Promise<MediaPlayerOption[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.system.listMediaPlayers),
  },
  ai: {
    getStatus: (baseUrl?: string): Promise<AiStatusSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.getStatus, baseUrl),
    listModels: (baseUrl?: string): Promise<AiInstalledModel[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.listModels, baseUrl),
    pullModel: (model: string, baseUrl?: string): Promise<AiPullResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.pullModel, model, baseUrl),
    cancelPull: (): Promise<{ ok: true }> => ipcRenderer.invoke(IPC_CHANNELS.ai.cancelPull),
    deleteModel: (model: string, baseUrl?: string): Promise<AiDeleteResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.ai.deleteModel, model, baseUrl),
    chat: (
      messages: AiChatMessage[],
      options?: { model?: string; baseUrl?: string },
    ): Promise<AiChatResult> => ipcRenderer.invoke(IPC_CHANNELS.ai.chat, messages, options),
    onPullProgress: (callback: (event: AiPullProgressEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: AiPullProgressEvent) => {
        callback(payload);
      };
      ipcRenderer.on(IPC_CHANNELS.ai.pullProgress, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.ai.pullProgress, listener);
      };
    },
  },
  detail: {
    tryFocus: (mediaId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.detail.tryFocus, mediaId),
    open: (item: StoredMediaItem): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.detail.open, item),
    get: (mediaId: string): Promise<StoredMediaItem | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.detail.get, mediaId),
    close: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.detail.close),
    notifyReady: (mediaId: string): void => {
      ipcRenderer.send(IPC_CHANNELS.detail.ready, mediaId);
    },
    onReady: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.once(IPC_CHANNELS.detail.ready, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.detail.ready, listener);
      };
    },
  },
  player: {
    openTorrent: (payload: PlayerOpenTorrentPayload): Promise<PlayerOpenTorrentResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.player.openTorrent, payload),
    get: (): Promise<MediaPlaybackSession | null> => ipcRenderer.invoke(IPC_CHANNELS.player.get),
    close: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.player.close),
    notifyReady: (): void => {
      ipcRenderer.send(IPC_CHANNELS.player.ready);
    },
    onReady: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.once(IPC_CHANNELS.player.ready, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.player.ready, listener);
      };
    },
    onSession: (callback: (session: MediaPlaybackSession) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        session: MediaPlaybackSession,
      ) => {
        callback(session);
      };
      ipcRenderer.on(IPC_CHANNELS.player.session, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.player.session, listener);
      };
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
