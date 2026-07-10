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
  loadRecentlyViewed,
  trackRecentlyViewedItem,
} from '@/shared/domain/recentlyViewedStorage';

interface RecentlyViewedContextValue {
  recentlyViewed: MediaItem[];
  isLoading: boolean;
  trackView: (item: MediaItem) => Promise<void>;
  reloadRecentlyViewed: () => Promise<void>;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const [recentlyViewed, setRecentlyViewed] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void ensureMediaOverridesLoaded()
      .then(() => loadRecentlyViewed())
      .then((loaded) => {
        if (!cancelled) {
          setRecentlyViewed(loaded);
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
    const unsubscribe = window.electronAPI?.recentlyViewed?.onChanged?.(() => {
      void ensureMediaOverridesLoaded()
        .then(() => loadRecentlyViewed())
        .then((loaded) => {
          setRecentlyViewed(loaded);
        });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const trackView = useCallback(async (item: MediaItem) => {
    const next = await trackRecentlyViewedItem(item);
    setRecentlyViewed(next);
  }, []);

  const reloadRecentlyViewed = useCallback(async () => {
    setIsLoading(true);

    try {
      await ensureMediaOverridesLoaded();
      setRecentlyViewed(await loadRecentlyViewed());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      recentlyViewed,
      isLoading,
      trackView,
      reloadRecentlyViewed,
    }),
    [isLoading, recentlyViewed, reloadRecentlyViewed, trackView],
  );

  return (
    <RecentlyViewedContext.Provider value={value}>{children}</RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed() {
  const context = useContext(RecentlyViewedContext);

  if (!context) {
    throw new Error('useRecentlyViewed must be used within RecentlyViewedProvider');
  }

  return context;
}
