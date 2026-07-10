import { useEffect, useMemo, useState } from 'react';
import { vokinoRepository } from '@/shared/api/vokino/repository';
import type { MediaItem } from '@/shared/domain/media';

export function useMediaSearch(query: string) {
  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const home = await vokinoRepository.getHomePage();
        if (cancelled) {
          return;
        }

        const merged = home.rows.flatMap((row) => row.items);
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
    if (!query.trim()) {
      return [];
    }

    const normalizedQuery = query.toLowerCase();
    return catalog.filter(
      (item) =>
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.subtitle?.toLowerCase().includes(normalizedQuery) ||
        item.genres.some((genre) => genre.toLowerCase().includes(normalizedQuery)) ||
        item.description?.toLowerCase().includes(normalizedQuery),
    );
  }, [catalog, query]);

  return { isLoading, results };
}
