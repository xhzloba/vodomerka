import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { ensureMediaOverridesLoaded } from '@/shared/domain/overridesStore';
import {
  addWatchedItem,
  clearAllWatched as clearAllWatchedStorage,
  loadWatched,
  removeWatchedItem,
} from '@/shared/domain/watchedStorage';
import { playLikeSound } from '@/shared/audio/uiSounds';

interface WatchedContextValue {
  watched: MediaItem[];
  watchedIds: Set<string>;
  isLoading: boolean;
  isWatched: (mediaId: string) => boolean;
  addWatched: (item: MediaItem) => Promise<void>;
  removeWatched: (mediaId: string) => Promise<void>;
  clearAllWatched: () => Promise<void>;
  reloadWatched: () => Promise<void>;
  toggleWatched: (item: MediaItem) => Promise<boolean>;
}

const WatchedContext = createContext<WatchedContextValue | null>(null);

export function WatchedProvider({ children }: { children: ReactNode }) {
  const [watched, setWatched] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void ensureMediaOverridesLoaded()
      .then(() => loadWatched())
      .then((loaded) => {
        if (!cancelled) {
          setWatched(loaded);
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
        .then(() => loadWatched())
        .then((loaded) => {
          setWatched(loaded);
        });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const watchedIds = useMemo(() => new Set(watched.map((item) => item.id)), [watched]);

  const isWatched = useCallback((mediaId: string) => watchedIds.has(mediaId), [watchedIds]);

  const addWatched = useCallback(async (item: MediaItem) => {
    const next = await addWatchedItem(item);
    setWatched(next);
    playLikeSound();
  }, []);

  const removeWatched = useCallback(async (mediaId: string) => {
    const next = await removeWatchedItem(mediaId);
    setWatched(next);
    playLikeSound();
  }, []);

  const clearAllWatched = useCallback(async () => {
    const next = await clearAllWatchedStorage();
    setWatched(next);
  }, []);

  const reloadWatched = useCallback(async () => {
    setIsLoading(true);

    try {
      await ensureMediaOverridesLoaded();
      setWatched(await loadWatched());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleWatched = useCallback(
    async (item: MediaItem) => {
      if (watchedIds.has(item.id)) {
        await removeWatched(item.id);
        return false;
      }

      await addWatched(item);
      return true;
    },
    [addWatched, removeWatched, watchedIds],
  );

  const value = useMemo(
    () => ({
      watched,
      watchedIds,
      isLoading,
      isWatched,
      addWatched,
      removeWatched,
      clearAllWatched,
      reloadWatched,
      toggleWatched,
    }),
    [
      addWatched,
      clearAllWatched,
      isLoading,
      isWatched,
      reloadWatched,
      removeWatched,
      toggleWatched,
      watched,
      watchedIds,
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
