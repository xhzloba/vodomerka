import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type AppSettings,
  type BackupResult,
  type ElectronApi,
  type InstalledSidebarAnimationPlugin,
  type InstalledThemePlugin,
  type MediaOverridesMap,
  type PluginResult,
  type StoredMediaItem,
  type ThemeCatalog,
} from '../contracts/ipc';

const electronApi: ElectronApi = {
  platform: process.platform,
  api: {
    get: (url: string): Promise<unknown> => ipcRenderer.invoke(IPC_CHANNELS.api.get, url),
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
  watched: {
    list: (): Promise<StoredMediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.watched.list),
    add: (item: StoredMediaItem): Promise<StoredMediaItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.watched.add, item),
    remove: (mediaId: string): Promise<StoredMediaItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.watched.remove, mediaId),
    has: (mediaId: string): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.watched.has, mediaId),
    clear: (): Promise<StoredMediaItem[]> => ipcRenderer.invoke(IPC_CHANNELS.watched.clear),
    onChanged: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.watched.changed, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.watched.changed, listener);
      };
    },
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
  },
  system: {
    getUserDisplayName: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.system.getUserDisplayName),
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
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
