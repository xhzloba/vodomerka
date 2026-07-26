import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  TorrentAddPayload,
  TorrentAddResult,
  TorrentDownloadRecord,
} from '../../../contracts/ipc';

interface TorrentsContextValue {
  torrents: TorrentDownloadRecord[];
  isLoading: boolean;
  activeCount: number;
  folderPath: string | null;
  addTorrent: (payload: TorrentAddPayload) => Promise<TorrentAddResult>;
  removeTorrent: (id: string, deleteFiles?: boolean) => Promise<void>;
  openTorrentFile: (id: string) => Promise<{ ok: boolean; error?: string }>;
  openTorrentsFolder: () => Promise<{ ok: boolean; error?: string }>;
  reload: () => Promise<void>;
}

const TorrentsContext = createContext<TorrentsContextValue | null>(null);

export function TorrentsProvider({ children }: { children: ReactNode }) {
  const [torrents, setTorrents] = useState<TorrentDownloadRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [folderPath, setFolderPath] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!window.electronAPI?.torrents) {
      setTorrents([]);
      setIsLoading(false);
      return;
    }
    const [items, folder] = await Promise.all([
      window.electronAPI.torrents.list(),
      window.electronAPI.torrents.getFolderPath(),
    ]);
    setTorrents(items);
    setFolderPath(folder);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void reload().finally(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.torrents?.onChanged?.((items) => {
      setTorrents(items);
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const addTorrent = useCallback(async (payload: TorrentAddPayload) => {
    if (!window.electronAPI?.torrents) {
      return { ok: false as const, error: 'Торренты доступны только в приложении' };
    }
    const result = await window.electronAPI.torrents.add(payload);
    if (result.ok) {
      await reload();
    }
    return result;
  }, [reload]);

  const removeTorrent = useCallback(
    async (id: string, deleteFiles = false) => {
      if (!window.electronAPI?.torrents) {
        return;
      }
      const next = await window.electronAPI.torrents.remove(id, deleteFiles);
      setTorrents(next);
    },
    [],
  );

  const openTorrentFile = useCallback(async (id: string) => {
    if (!window.electronAPI?.torrents) {
      return { ok: false, error: 'Недоступно' };
    }
    return window.electronAPI.torrents.openFile(id);
  }, []);

  const openTorrentsFolder = useCallback(async () => {
    if (!window.electronAPI?.torrents) {
      return { ok: false, error: 'Недоступно' };
    }
    return window.electronAPI.torrents.openFolder();
  }, []);

  const activeCount = useMemo(
    () =>
      torrents.filter((item) => item.status === 'downloading' || item.status === 'queued').length,
    [torrents],
  );

  const value = useMemo(
    () => ({
      torrents,
      isLoading,
      activeCount,
      folderPath,
      addTorrent,
      removeTorrent,
      openTorrentFile,
      openTorrentsFolder,
      reload,
    }),
    [
      torrents,
      isLoading,
      activeCount,
      folderPath,
      addTorrent,
      removeTorrent,
      openTorrentFile,
      openTorrentsFolder,
      reload,
    ],
  );

  return <TorrentsContext.Provider value={value}>{children}</TorrentsContext.Provider>;
}

export function useTorrents() {
  const context = useContext(TorrentsContext);
  if (!context) {
    throw new Error('useTorrents must be used within TorrentsProvider');
  }
  return context;
}
