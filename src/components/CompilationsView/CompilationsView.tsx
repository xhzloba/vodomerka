import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import {
  fetchAllCompilations,
  type VokinoCompilationItem,
} from '@/shared/api/vokino/compilations';
import { fetchPaginatedList, mergeUniqueItems } from '@/shared/api/vokino/browse';
import { applyCompilationFilters } from '@/features/compilations/model/applyCompilationFilters';
import {
  CompilationFiltersPanel,
  useCompilationFilters,
} from '@/features/compilations/ui/CompilationFiltersPanel';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { ChevronLeftIcon, FilterIcon } from '@/shared/ui/icons';
import { PageError, PageLoading } from '@/shared/ui/PageState';
import { useAppTopProgress } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { SlideMenu } from '@/shared/ui/SlideMenu';
import { CompilationCard } from '@/components/CompilationsView/CompilationCard';
import { MediaGrid } from '@/components/BrowseView/MediaGrid';
import '../BrowseView/BrowseView.css';
import '../BrowseView/MediaGrid.css';
import '@/features/browse/ui/BrowseFiltersPanel.css';
import './CompilationsView.css';

interface CompilationsViewProps {
  onMediaSelect: (item: MediaItem) => void;
}

export function CompilationsView({ onMediaSelect }: CompilationsViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();

  const [compilations, setCompilations] = useState<VokinoCompilationItem[]>([]);
  const [selectedCompilation, setSelectedCompilation] = useState<VokinoCompilationItem | null>(null);
  const [detailItems, setDetailItems] = useState<MediaItem[]>([]);
  const [detailNextUrl, setDetailNextUrl] = useState<string | null>(null);

  const [isListLoading, setIsListLoading] = useState(true);
  const [isListLoadingMore, setIsListLoadingMore] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailLoadingMore, setIsDetailLoadingMore] = useState(false);
  const [isFiltersMenuOpen, setIsFiltersMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    filters,
    activeCount,
    setFilter,
    resetFilters,
  } = useCompilationFilters();

  const filteredDetailItems = useMemo(
    () => applyCompilationFilters(detailItems, filters),
    [detailItems, filters],
  );

  const filtersContextLabel = selectedCompilation
    ? `Фильтрация «${selectedCompilation.details.name}» на текущем списке`
    : 'Подборка';

  const showListProgress = isListLoading || isListLoadingMore;
  const showDetailProgress = isDetailLoading;

  useAppTopProgress(
    'compilations',
    selectedCompilation ? showDetailProgress : showListProgress,
    selectedCompilation ? 'Загрузка подборки' : 'Загрузка подборок',
  );

  const loadCompilations = useCallback(async () => {
    setIsListLoading(true);
    setIsListLoadingMore(false);
    setError(null);
    setCompilations([]);

    try {
      await fetchAllCompilations((items) => {
        setCompilations(items);

        if (items.length > 0) {
          setIsListLoading(false);
          setIsListLoadingMore(true);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить подборки');
    } finally {
      setIsListLoading(false);
      setIsListLoadingMore(false);
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

  const handleCompilationSelect = (compilation: VokinoCompilationItem) => {
    resetFilters();
    setIsFiltersMenuOpen(false);
    setSelectedCompilation(compilation);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    void loadCompilationContent(compilation);
  };

  const handleBackToList = () => {
    resetFilters();
    setIsFiltersMenuOpen(false);
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
      <div ref={scrollRef} className="library-view compilations-view compilations-view--list scroll-overlay">
        <div className="library-view__header">
          <div className="library-view__title-group">
            <h1 className="library-view__title">Подборки</h1>
          </div>
        </div>
        <PageError title="Ошибка подборок" text={error} onAction={() => void loadCompilations()} />
      </div>
    );
  }

  if (selectedCompilation) {
    const hasActiveFilters = activeCount > 0;
    const showFilteredEmpty =
      !isDetailLoading && detailItems.length > 0 && filteredDetailItems.length === 0;

    return (
      <div className="library-view compilations-view compilations-view--detail">
        <div className="library-view__header compilations-view__header">
          <nav className="compilations-view__breadcrumb" aria-label="Навигация по подборкам">
            <button
              type="button"
              className="compilations-view__back"
              onClick={handleBackToList}
              aria-label="Назад к подборкам"
            >
              <ChevronLeftIcon size={24} strokeWidth={1.75} />
              <span>Подборки</span>
            </button>
            <h1 className="compilations-view__detail-title">{selectedCompilation.details.name}</h1>
          </nav>

          <div className="compilations-view__header-actions">
            <button
              type="button"
              className={`browse-view__filters-trigger${
                isFiltersMenuOpen ? ' browse-view__filters-trigger--open' : ''
              }${hasActiveFilters ? ' browse-view__filters-trigger--active' : ''}`}
              onClick={() => setIsFiltersMenuOpen(true)}
              disabled={isDetailLoading || detailItems.length === 0}
              aria-haspopup="dialog"
              aria-expanded={isFiltersMenuOpen}
              aria-label={hasActiveFilters ? `Фильтры, активно: ${activeCount}` : 'Фильтры'}
            >
              <FilterIcon size={18} />
              <span className="browse-view__filters-trigger-label">Фильтры</span>
              {hasActiveFilters ? (
                <span className="browse-view__filters-badge" aria-hidden="true">
                  {activeCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <SlideMenu
          open={isFiltersMenuOpen}
          title="Фильтры"
          size="xlarge"
          onClose={() => setIsFiltersMenuOpen(false)}
        >
          <CompilationFiltersPanel
            items={detailItems}
            filters={filters}
            contextLabel={filtersContextLabel}
            onChange={setFilter}
            onReset={resetFilters}
          />
        </SlideMenu>

        <div ref={scrollRef} className="compilations-view__detail-scroll scroll-overlay">
          <div className="compilations-view__detail">
            {error ? <p className="browse-view__error">{error}</p> : null}

            {isDetailLoading ? (
              <div className="page-state-overlay" aria-busy="true" aria-label="Загрузка подборки">
                <PageLoading />
              </div>
            ) : null}

            {!isDetailLoading && filteredDetailItems.length > 0 ? (
              <MediaGrid
                items={filteredDetailItems}
                isLoadingMore={isDetailLoadingMore && !hasActiveFilters}
                hasMore={Boolean(detailNextUrl) && !hasActiveFilters}
                onLoadMore={handleDetailLoadMore}
                onMediaSelect={onMediaSelect}
              />
            ) : null}

            {showFilteredEmpty ? (
              <p className="browse-view__empty">Ничего не найдено по выбранным фильтрам</p>
            ) : null}

            {!isDetailLoading && !error && detailItems.length === 0 ? (
              <p className="browse-view__empty">В этой подборке пока нет контента</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="library-view compilations-view compilations-view--list scroll-overlay">
      <div className="library-view__header">
        <div className="library-view__title-group">
          <h1 className="library-view__title">Подборки</h1>
        </div>
      </div>

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
            {isListLoadingMore ? (
              <div className="compilations-view__list-footer compilations-view__list-footer--loading">
                <div className="media-grid__loader" />
              </div>
            ) : null}
          </div>
        ) : null}

        {!isListLoading && compilations.length === 0 ? (
          <p className="browse-view__empty">Подборки пока недоступны</p>
        ) : null}
      </div>
    </div>
  );
}
