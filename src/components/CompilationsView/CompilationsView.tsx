import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import {
  fetchCompilationsPage,
  type VokinoCompilationItem,
} from '@/shared/api/vokino/compilations';
import { fetchPaginatedList, mergeUniqueItems } from '@/shared/api/vokino/browse';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { ChevronLeftIcon } from '@/shared/ui/icons';
import { PageError, PageLoading } from '@/shared/ui/PageState';
import { CompilationCard } from '@/components/CompilationsView/CompilationCard';
import { MediaGrid } from '@/components/BrowseView/MediaGrid';
import '../BrowseView/BrowseView.css';
import '../BrowseView/MediaGrid.css';
import './CompilationsView.css';

interface CompilationsViewProps {
  onMediaSelect: (item: MediaItem) => void;
}

export function CompilationsView({ onMediaSelect }: CompilationsViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const listLoadingMoreRef = useRef(false);

  const [compilations, setCompilations] = useState<VokinoCompilationItem[]>([]);
  const [listNextUrl, setListNextUrl] = useState<string | null>(null);
  const [selectedCompilation, setSelectedCompilation] = useState<VokinoCompilationItem | null>(null);
  const [detailItems, setDetailItems] = useState<MediaItem[]>([]);
  const [detailNextUrl, setDetailNextUrl] = useState<string | null>(null);

  const [isListLoading, setIsListLoading] = useState(true);
  const [isListLoadingMore, setIsListLoadingMore] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailLoadingMore, setIsDetailLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompilations = useCallback(async (pageUrl?: string | null, append = false) => {
    if (append) {
      if (listLoadingMoreRef.current || !pageUrl) {
        return;
      }

      listLoadingMoreRef.current = true;
      setIsListLoadingMore(true);
    } else {
      setIsListLoading(true);
      setError(null);
      setCompilations([]);
      setListNextUrl(null);
    }

    try {
      const result = await fetchCompilationsPage(pageUrl);
      let appendedCount = 0;

      setCompilations((current) => {
        if (!append) {
          return result.items;
        }

        const seen = new Set(current.map((item) => item.details.id));
        const merged = [...current];

        for (const item of result.items) {
          if (seen.has(item.details.id)) {
            continue;
          }

          seen.add(item.details.id);
          merged.push(item);
          appendedCount += 1;
        }

        return merged;
      });

      if (append && appendedCount === 0) {
        setListNextUrl(null);
      } else {
        setListNextUrl(result.nextUrl);
      }
    } catch (err) {
      if (!append) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить подборки');
      }
    } finally {
      if (append) {
        listLoadingMoreRef.current = false;
        setIsListLoadingMore(false);
      } else {
        setIsListLoading(false);
      }
    }
  }, []);

  const loadCompilationContent = useCallback(
    async (compilation: VokinoCompilationItem, pageUrl?: string | null, append = false) => {
      if (append) {
        setIsDetailLoadingMore(true);
      } else {
        setIsDetailLoading(true);
        setError(null);
        setDetailItems([]);
        setDetailNextUrl(null);
      }

      try {
        const result = await fetchPaginatedList(compilation.playlist_url, pageUrl);
        setDetailItems((current) =>
          append ? mergeUniqueItems(current, result.items) : result.items,
        );
        setDetailNextUrl(result.nextUrl);
      } catch (err) {
        if (!append) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить подборку');
        }
      } finally {
        if (append) {
          setIsDetailLoadingMore(false);
        } else {
          setIsDetailLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadCompilations();
  }, [loadCompilations]);

  const listHasMore = listNextUrl !== null;

  useEffect(() => {
    if (selectedCompilation || !listHasMore || isListLoading || isListLoadingMore) {
      return;
    }

    const root = scrollRef.current;
    const sentinel = listSentinelRef.current;
    if (!root || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadCompilations(listNextUrl, true);
        }
      },
      { root, rootMargin: '480px 0px', threshold: 0 },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [
    isListLoading,
    isListLoadingMore,
    listHasMore,
    listNextUrl,
    loadCompilations,
    scrollRef,
    selectedCompilation,
    compilations.length,
  ]);

  const handleCompilationSelect = (compilation: VokinoCompilationItem) => {
    setSelectedCompilation(compilation);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    void loadCompilationContent(compilation);
  };

  const handleBackToList = () => {
    setSelectedCompilation(null);
    setDetailItems([]);
    setDetailNextUrl(null);
    setError(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleDetailLoadMore = useCallback(() => {
    if (!selectedCompilation || !detailNextUrl || isDetailLoading || isDetailLoadingMore) {
      return;
    }

    void loadCompilationContent(selectedCompilation, detailNextUrl, true);
  }, [
    detailNextUrl,
    isDetailLoading,
    isDetailLoadingMore,
    loadCompilationContent,
    selectedCompilation,
  ]);

  if (error && !selectedCompilation && compilations.length === 0 && !isListLoading) {
    return (
      <div className="compilations-view browse-view">
        <div ref={scrollRef} className="browse-view__scroll scroll-overlay">
          <PageError title="Ошибка подборок" text={error} onAction={() => void loadCompilations()} />
        </div>
      </div>
    );
  }

  return (
    <div className="compilations-view browse-view">
      <div className="compilations-view__header browse-view__header">
        {selectedCompilation ? (
          <button
            type="button"
            className="compilations-view__back"
            onClick={handleBackToList}
            aria-label="Назад к подборкам"
          >
            <ChevronLeftIcon size={18} strokeWidth={1.75} />
            <span>Подборки</span>
          </button>
        ) : (
          <h1 className="compilations-view__title">Подборки</h1>
        )}

        {selectedCompilation ? (
          <h1 className="compilations-view__detail-title">{selectedCompilation.details.name}</h1>
        ) : null}
      </div>

      <div ref={scrollRef} className="browse-view__scroll scroll-overlay">
        {selectedCompilation ? (
          <div className="compilations-view__detail">
            {error ? <p className="browse-view__error">{error}</p> : null}

            {isDetailLoading ? (
              <div className="page-state-overlay" aria-busy="true" aria-label="Загрузка подборки">
                <PageLoading />
              </div>
            ) : null}

            {!isDetailLoading && detailItems.length > 0 ? (
              <MediaGrid
                items={detailItems}
                isLoadingMore={isDetailLoadingMore}
                hasMore={Boolean(detailNextUrl)}
                onLoadMore={handleDetailLoadMore}
                onMediaSelect={onMediaSelect}
              />
            ) : null}

            {!isDetailLoading && !error && detailItems.length === 0 ? (
              <p className="browse-view__empty">В этой подборке пока нет контента</p>
            ) : null}
          </div>
        ) : (
          <div className="compilations-view__content">
            {isListLoading ? (
              <div className="page-state-overlay" aria-busy="true" aria-label="Загрузка подборок">
                <PageLoading />
              </div>
            ) : null}

            {!isListLoading && compilations.length > 0 ? (
              <div className="compilations-view__grid">
                {compilations.map((item) => (
                  <CompilationCard
                    key={item.details.id}
                    item={item}
                    onSelect={handleCompilationSelect}
                  />
                ))}
                {listHasMore ? (
                  <>
                    <div ref={listSentinelRef} className="media-grid__sentinel" aria-hidden="true" />
                    <div
                      className={`compilations-view__list-footer${
                        isListLoadingMore ? ' compilations-view__list-footer--loading' : ''
                      }`}
                      aria-hidden={!isListLoadingMore}
                    >
                      {isListLoadingMore ? <div className="media-grid__loader" /> : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {!isListLoading && compilations.length === 0 ? (
              <p className="browse-view__empty">Подборки пока недоступны</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
