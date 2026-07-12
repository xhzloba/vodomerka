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
  addFavoriteItem,
  clearAllFavorites as clearAllFavoritesStorage,
  loadFavorites,
  removeFavoriteItem,
} from '@/shared/domain/favoritesStorage';
import { playLikeSound } from '@/shared/audio/uiSounds';

interface FavoritesContextValue {
  favorites: MediaItem[];
  favoriteIds: Set<string>;
  isLoading: boolean;
  isFavorite: (mediaId: string) => boolean;
  addFavorite: (item: MediaItem) => Promise<void>;
  removeFavorite: (mediaId: string) => Promise<void>;
  clearAllFavorites: () => Promise<void>;
  reloadFavorites: () => Promise<void>;
  toggleFavorite: (item: MediaItem) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void ensureMediaOverridesLoaded()
      .then(() => loadFavorites())
      .then((loaded) => {
        if (!cancelled) {
          setFavorites(loaded);
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
    const unsubscribe = window.electronAPI?.favorites?.onChanged?.(() => {
      void ensureMediaOverridesLoaded()
        .then(() => loadFavorites())
        .then((loaded) => {
          setFavorites(loaded);
        });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);

  const isFavorite = useCallback(
    (mediaId: string) => favoriteIds.has(mediaId),
    [favoriteIds],
  );

  const addFavorite = useCallback(async (item: MediaItem) => {
    const next = await addFavoriteItem(item);
    setFavorites(next);
    playLikeSound();
  }, []);

  const removeFavorite = useCallback(async (mediaId: string) => {
    const next = await removeFavoriteItem(mediaId);
    setFavorites(next);
    playLikeSound();
  }, []);

  const clearAllFavorites = useCallback(async () => {
    const next = await clearAllFavoritesStorage();
    setFavorites(next);
  }, []);

  const reloadFavorites = useCallback(async () => {
    setIsLoading(true);

    try {
      await ensureMediaOverridesLoaded();
      setFavorites(await loadFavorites());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (item: MediaItem) => {
      if (favoriteIds.has(item.id)) {
        await removeFavorite(item.id);
        return false;
      }

      await addFavorite(item);
      return true;
    },
    [addFavorite, favoriteIds, removeFavorite],
  );

  const value = useMemo(
    () => ({
      favorites,
      favoriteIds,
      isLoading,
      isFavorite,
      addFavorite,
      removeFavorite,
      clearAllFavorites,
      reloadFavorites,
      toggleFavorite,
    }),
    [
      addFavorite,
      clearAllFavorites,
      favoriteIds,
      favorites,
      isFavorite,
      isLoading,
      reloadFavorites,
      removeFavorite,
      toggleFavorite,
    ],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }

  return context;
}
