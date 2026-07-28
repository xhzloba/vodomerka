import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  TorrentAddPayload,
  TorrentAddResult,
  TorrentDownloadRecord,
} from '../../../contracts/ipc';
import { fetchMediaById } from '@/shared/api/vokino/media';

interface TorrentsContextValue {
  torrents: TorrentDownloadRecord[];
  isLoading: boolean;
  activeCount: number;
  downloadActivity: {
    count: number;
    percent: number;
    title: string;
    id: string;
    posterUrl?: string;
    progress: number;
    canPlay: boolean;
  } | null;
  folderPath: string | null;
  addTorrent: (payload: TorrentAddPayload) => Promise<TorrentAddResult>;
  removeTorrent: (id: string, deleteFiles?: boolean) => Promise<void>;
  pauseTorrent: (id: string) => Promise<void>;
  resumeTorrent: (id: string) => Promise<void>;
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

  // Catalog type / poster for older downloads that only stored mediaId.
  const mediaMetaBackfillRef = useRef(new Set<string>());
  useEffect(() => {
    const setMediaType = window.electronAPI?.torrents?.setMediaType;
    const setPosterUrl = window.electronAPI?.torrents?.setPosterUrl;
    if (!setMediaType && !setPosterUrl) {
      return;
    }

    const missing = torrents.filter(
      (item) =>
        item.mediaId &&
        (!item.mediaType || !item.posterUrl) &&
        !mediaMetaBackfillRef.current.has(item.id),
    );
    if (missing.length === 0) {
      return;
    }

    let cancelled = false;
    void (async () => {
      for (const item of missing) {
        if (cancelled || !item.mediaId) {
          break;
        }
        mediaMetaBackfillRef.current.add(item.id);
        try {
          const media = await fetchMediaById(item.mediaId);
          if (cancelled || !media) {
            continue;
          }

          let next: TorrentDownloadRecord[] | null = null;
          if (!item.mediaType && media.type && setMediaType) {
            next = await setMediaType(item.id, media.type);
          }
          if (!item.posterUrl && media.poster && setPosterUrl) {
            next = await setPosterUrl(item.id, media.poster);
          }
          if (!cancelled && next) {
            setTorrents(next);
          }
        } catch {
          // best-effort; next app open can retry
          mediaMetaBackfillRef.current.delete(item.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [torrents]);

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

  const pauseTorrent = useCallback(async (id: string) => {
    if (!window.electronAPI?.torrents?.pause) {
      return;
    }
    const next = await window.electronAPI.torrents.pause(id);
    setTorrents(next);
  }, []);

  const resumeTorrent = useCallback(async (id: string) => {
    if (!window.electronAPI?.torrents?.resume) {
      return;
    }
    const next = await window.electronAPI.torrents.resume(id);
    setTorrents(next);
  }, []);

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

  const downloadActivity = useMemo(() => {
    const queue = torrents
      .filter((item) => item.status === 'downloading' || item.status === 'queued')
      .sort((a, b) => a.addedAt - b.addedAt);
    if (queue.length === 0) {
      return null;
    }

    // Stable primary: the one actually downloading (FIFO), not whichever updated last.
    const primary =
      queue.find((item) => item.status === 'downloading') ?? queue[0]!;
    const progress = Math.min(1, Math.max(0, primary.progress || 0));

    return {
      count: queue.length,
      percent: Math.round(progress * 10000) / 100,
      title: primary.mediaTitle || primary.title || 'Торрент',
      id: primary.id,
      posterUrl: primary.posterUrl,
      progress,
      canPlay: primary.status !== 'error',
    };
  }, [torrents]);

  const value = useMemo(
    () => ({
      torrents,
      isLoading,
      activeCount,
      downloadActivity,
      folderPath,
      addTorrent,
      removeTorrent,
      pauseTorrent,
      resumeTorrent,
      openTorrentFile,
      openTorrentsFolder,
      reload,
    }),
    [
      torrents,
      isLoading,
      activeCount,
      downloadActivity,
      folderPath,
      addTorrent,
      removeTorrent,
      pauseTorrent,
      resumeTorrent,
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
