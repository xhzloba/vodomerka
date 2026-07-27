import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchMediaById } from '@/shared/api/vokino/media';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded } from '@/shared/domain/overridesStore';
import {
  clearWatchStatusBucket,
  loadWatchStatuses,
  removeWatchStatusItem,
  setWatchStatusItem,
  type WatchStatusEntry,
} from '@/shared/domain/watchedStorage';
import { WATCH_STATUS_LABELS, type WatchStatus } from '@/shared/domain/watchStatus';
import { playLikeSound } from '@/shared/audio/uiSounds';
import { normalizeMediaType } from '../../../contracts/mediaType';

async function resolveItemForStatus(item: MediaItem): Promise<MediaItem> {
  const normalized = normalizeMediaType(item.type);
  const classified = isMovieMedia(item) || isSerialMedia(item);

  if (normalized && classified) {
    return normalized === item.type ? item : { ...item, type: normalized };
  }

  if (!item.id || item.id.startsWith('torrent:')) {
    return normalized ? { ...item, type: normalized } : item;
  }

  try {
    const full = await fetchMediaById(item.id);
    if (full) {
      const fullType = normalizeMediaType(full.type) ?? full.type;
      return { ...full, type: fullType };
    }
  } catch {
    // keep local payload
  }

  return normalized ? { ...item, type: normalized } : item;
}

interface WatchedContextValue {
  entries: WatchStatusEntry[];
  isLoading: boolean;
  getStatus: (mediaId: string) => WatchStatus | null;
  listByStatus: (status: WatchStatus) => MediaItem[];
  setStatus: (item: MediaItem, status: WatchStatus, options?: { silent?: boolean }) => Promise<void>;
  clearStatus: (mediaId: string) => Promise<void>;
  clearBucket: (status: WatchStatus) => Promise<void>;
  reloadWatchStatuses: () => Promise<void>;
  /** Compat: true when status === 'watched' */
  isWatched: (mediaId: string) => boolean;
  watched: MediaItem[];
  watchedIds: Set<string>;
  addWatched: (item: MediaItem, options?: { silent?: boolean }) => Promise<void>;
  removeWatched: (mediaId: string) => Promise<void>;
  clearAllWatched: () => Promise<void>;
  reloadWatched: () => Promise<void>;
  toggleWatched: (item: MediaItem) => Promise<boolean>;
  toggleStatus: (item: MediaItem, status: WatchStatus) => Promise<boolean>;
}

const WatchedContext = createContext<WatchedContextValue | null>(null);

export function WatchedProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<WatchStatusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void ensureMediaOverridesLoaded()
      .then(() => loadWatchStatuses())
      .then((loaded) => {
        if (!cancelled) {
          setEntries(loaded);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.watched?.onChanged?.(() => {
      void ensureMediaOverridesLoaded()
        .then(() => loadWatchStatuses())
        .then((loaded) => {
          setEntries(loaded);
        });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const statusById = useMemo(() => {
    const map = new Map<string, WatchStatus>();
    for (const entry of entries) {
      map.set(entry.item.id, entry.status);
    }
    return map;
  }, [entries]);

  const getStatus = useCallback(
    (mediaId: string) => statusById.get(mediaId) ?? null,
    [statusById],
  );

  const listByStatus = useCallback(
    (status: WatchStatus) =>
      entries.filter((entry) => entry.status === status).map((entry) => entry.item),
    [entries],
  );

  const setStatus = useCallback(
    async (item: MediaItem, status: WatchStatus, options?: { silent?: boolean }) => {
      if (!options?.silent) {
        playLikeSound();
      }
      const resolved = await resolveItemForStatus(item);
      const next = await setWatchStatusItem(resolved, status);
      setEntries(next);
    },
    [],
  );

  const clearStatus = useCallback(async (mediaId: string) => {
    playLikeSound();
    const next = await removeWatchStatusItem(mediaId);
    setEntries(next);
  }, []);

  const clearBucket = useCallback(async (status: WatchStatus) => {
    const next = await clearWatchStatusBucket(status);
    setEntries(next);
  }, []);

  const reloadWatchStatuses = useCallback(async () => {
    setIsLoading(true);
    try {
      await ensureMediaOverridesLoaded();
      setEntries(await loadWatchStatuses());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const watched = useMemo(() => listByStatus('watched'), [listByStatus]);
  const watchedIds = useMemo(() => new Set(watched.map((item) => item.id)), [watched]);
  const isWatched = useCallback(
    (mediaId: string) => getStatus(mediaId) === 'watched',
    [getStatus],
  );

  const addWatched = useCallback(
    async (item: MediaItem, options?: { silent?: boolean }) => {
      await setStatus(item, 'watched', options);
    },
    [setStatus],
  );

  const removeWatched = useCallback(
    async (mediaId: string) => {
      if (getStatus(mediaId) === 'watched') {
        await clearStatus(mediaId);
      }
    },
    [clearStatus, getStatus],
  );

  const clearAllWatched = useCallback(async () => {
    await clearBucket('watched');
  }, [clearBucket]);

  const toggleWatched = useCallback(
    async (item: MediaItem) => {
      if (getStatus(item.id) === 'watched') {
        await clearStatus(item.id);
        return false;
      }
      await setStatus(item, 'watched');
      return true;
    },
    [clearStatus, getStatus, setStatus],
  );

  const toggleStatus = useCallback(
    async (item: MediaItem, status: WatchStatus) => {
      if (getStatus(item.id) === status) {
        await clearStatus(item.id);
        return false;
      }
      await setStatus(item, status);
      return true;
    },
    [clearStatus, getStatus, setStatus],
  );

  const value = useMemo(
    () => ({
      entries,
      isLoading,
      getStatus,
      listByStatus,
      setStatus,
      clearStatus,
      clearBucket,
      reloadWatchStatuses,
      isWatched,
      watched,
      watchedIds,
      addWatched,
      removeWatched,
      clearAllWatched,
      reloadWatched: reloadWatchStatuses,
      toggleWatched,
      toggleStatus,
    }),
    [
      entries,
      isLoading,
      getStatus,
      listByStatus,
      setStatus,
      clearStatus,
      clearBucket,
      reloadWatchStatuses,
      isWatched,
      watched,
      watchedIds,
      addWatched,
      removeWatched,
      clearAllWatched,
      toggleWatched,
      toggleStatus,
    ],
  );

  return <WatchedContext.Provider value={value}>{children}</WatchedContext.Provider>;
}

export function useWatched() {
  const context = useContext(WatchedContext);
  if (!context) {
    throw new Error('useWatched must be used within WatchedProvider');
  }
  return context;
}

export function getWatchStatusToastCopy(status: WatchStatus, added: boolean, title: string) {
  const label = WATCH_STATUS_LABELS[status];
  if (added) {
    return {
      title: label,
      message: `«${title}» → ${label}`,
    };
  }
  return {
    title: 'Убрано',
    message: `«${title}» убрано из «${label}»`,
  };
}
