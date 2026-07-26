import { useEffect, useMemo, useState } from 'react';
import { vokinoRepository } from '@/shared/api/vokino/repository';
import { isTrendingHomeRow } from '@/shared/domain/homeSections';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';

export type SearchTypeFilter = 'all' | 'movie' | 'serial';

const TRENDING_IDLE_LIMIT = 10;

export function useMediaSearch(query: string, typeFilter: SearchTypeFilter = 'all') {
  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const home = await vokinoRepository.getHomePage();
        if (cancelled) {
          return;
        }

        const trendingRow = home.rows.find((row) => isTrendingHomeRow(row));
        const trendingItems = trendingRow?.items ?? [];
        const merged = home.rows.flatMap((row) => row.items);

        setTrending(trendingItems);
        setCatalog(Array.from(new Map(merged.map((item) => [item.id, item])).values()));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      if (typeFilter === 'all') {
        return [];
      }

      const filteredTrending =
        typeFilter === 'movie'
          ? trending.filter(isMovieMedia)
          : trending.filter(isSerialMedia);

      return filteredTrending.slice(0, TRENDING_IDLE_LIMIT);
    }

    let items = catalog;

    if (typeFilter === 'movie') {
      items = items.filter(isMovieMedia);
    } else if (typeFilter === 'serial') {
      items = items.filter(isSerialMedia);
    }

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.subtitle?.toLowerCase().includes(normalizedQuery) ||
        item.genres.some((genre) => genre.toLowerCase().includes(normalizedQuery)) ||
        item.description?.toLowerCase().includes(normalizedQuery),
    );
  }, [catalog, trending, query, typeFilter]);

  return { isLoading, results };
}
