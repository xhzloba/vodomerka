import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import type { VokinoCategory } from '@/shared/api/vokino/types';
import {
  type BrowseTab,
  fetchBrowseTabs,
  fetchPaginatedList,
  getDefaultBrowseCategory,
  mergeUniqueItems,
  sortBrowseCategories,
} from '@/shared/api/vokino/browse';
import { vokinoRepository } from '@/shared/api/vokino/repository';
import { ensureMediaOverridesLoaded, hydrateMediaItems } from '@/shared/domain/overridesStore';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import {
  CATALOG_GAP_VALUES,
  CATALOG_ROW_GAP_OPTIONS,
  type CatalogRowGapPreset,
} from '@/shared/settings/types';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { PageError, PageLoading } from '@/shared/ui/PageState';
import { SettingsIcon } from '@/shared/ui/icons';
import { SlideMenu } from '@/shared/ui/SlideMenu';
import { Tabs } from '@/shared/ui/Tabs';
import { MediaGrid } from './MediaGrid';
import './BrowseView.css';
import './MediaGrid.css';

interface BrowseViewProps {
  onMediaSelect: (item: MediaItem) => void;
}

function pickDefaultTab(tabs: BrowseTab[]): BrowseTab | null {
  return tabs.find((tab) => tab.playlistUrl.includes('sort=popular')) ?? tabs[0] ?? null;
}

let browseCategoriesCache: VokinoCategory[] | null = null;

export function BrowseView({ onMediaSelect }: BrowseViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const requestIdRef = useRef(0);
  const { settings, updateSettings } = useAppSettings();

  const [categories, setCategories] = useState<VokinoCategory[]>(browseCategoriesCache ?? []);
  const [selectedCategory, setSelectedCategory] = useState<VokinoCategory | null>(() =>
    browseCategoriesCache ? getDefaultBrowseCategory(browseCategoriesCache) : null,
  );
  const [tabs, setTabs] = useState<BrowseTab[]>([]);
  const [activeTab, setActiveTab] = useState<BrowseTab | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(!browseCategoriesCache);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);

  const catalogGridStyle = {
    '--catalog-row-gap': `${CATALOG_GAP_VALUES[settings.catalogRowGap].row}px`,
    '--catalog-column-gap': `${CATALOG_GAP_VALUES[settings.catalogRowGap].column}px`,
  } as CSSProperties;

  const loadContent = useCallback(
    async (
      category: VokinoCategory,
      options?: { tab?: BrowseTab | null; pageUrl?: string | null; append?: boolean },
    ) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const append = options?.append ?? false;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsContentLoading(true);
        setError(null);
        setItems([]);
        setNextPageUrl(null);
      }

      try {
        let playlistUrl = category.playlist_url;
        const pageUrl = options?.pageUrl ?? null;

        if (!append) {
          const categoryTabs = category.is_category === 1 ? await fetchBrowseTabs(category) : [];
          if (requestId !== requestIdRef.current) return;

          setTabs(categoryTabs);

          const nextTab = options?.tab ?? pickDefaultTab(categoryTabs);
          setActiveTab(nextTab);

          if (nextTab) {
            playlistUrl = nextTab.playlistUrl;
          }
        }

        const result = await fetchPaginatedList(playlistUrl, pageUrl);
        if (requestId !== requestIdRef.current) return;

        setItems((current) =>
          append ? mergeUniqueItems(current, result.items) : result.items,
        );
        setNextPageUrl(result.nextUrl);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

        if (!append) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить каталог');
          setItems([]);
          setNextPageUrl(null);
        }
      } finally {
        if (requestId !== requestIdRef.current) return;

        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsContentLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const onScroll = () => {
      setIsHeaderScrolled(element.scrollTop > 2);
    };

    onScroll();
    element.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', onScroll);
    };
  }, [scrollRef, items.length, isContentLoading, error]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      if (!browseCategoriesCache) {
        setIsCategoriesLoading(true);
      }

      setError(null);

      try {
        const main = await vokinoRepository.getMain();
        if (cancelled) return;

        const nextCategories = sortBrowseCategories(main.channels);
        const defaultCategory = getDefaultBrowseCategory(nextCategories);

        browseCategoriesCache = nextCategories;
        setCategories(nextCategories);
        setSelectedCategory(defaultCategory);

        if (defaultCategory) {
          void loadContent(defaultCategory);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить каталог');
        }
      } finally {
        if (!cancelled) {
          setIsCategoriesLoading(false);
        }
      }
    }

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, [loadContent]);

  useEffect(() => {
    void ensureMediaOverridesLoaded().then(() => {
      setItems((current) => (current.length > 0 ? hydrateMediaItems(current) : current));
    });
  }, []);

  const handleCategorySelect = (category: VokinoCategory) => {
    setSelectedCategory(category);
    setIsCategoryMenuOpen(false);
    void loadContent(category);
  };

  const handleCatalogGapSelect = (preset: CatalogRowGapPreset) => {
    void updateSettings({ catalogRowGap: preset });
  };

  const openCategoryMenu = () => {
    setIsSettingsMenuOpen(false);
    setIsCategoryMenuOpen(true);
  };

  const openSettingsMenu = () => {
    setIsCategoryMenuOpen(false);
    setIsSettingsMenuOpen(true);
  };

  const handleTabSelect = (tabId: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!selectedCategory || !tab || tab.id === activeTab?.id) {
      return;
    }

    setActiveTab(tab);
    void loadContent(selectedCategory, { tab });
  };

  const handleLoadMore = useCallback(() => {
    if (!selectedCategory || !nextPageUrl || isLoadingMore || isContentLoading) {
      return;
    }

    void loadContent(selectedCategory, { pageUrl: nextPageUrl, append: true });
  }, [selectedCategory, nextPageUrl, isLoadingMore, isContentLoading, loadContent]);

  const scrollShadow = (
    <div
      className={`browse-view__scroll-top-shadow${isHeaderScrolled ? ' browse-view__scroll-top-shadow--visible' : ''}`}
      aria-hidden="true"
    />
  );

  if (error && categories.length === 0 && !isCategoriesLoading) {
    return (
      <div className="browse-view">
        <div className="browse-view__header">
          <div className="browse-view__header-main">
            <div className="browse-view__title-group">
              <h1 className="browse-view__title">Каталог</h1>
              <button
                type="button"
                className="browse-view__settings-trigger"
                aria-label="Настройки каталога"
                onClick={openSettingsMenu}
              >
                <SettingsIcon size={22} />
              </button>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="browse-view__scroll scroll-overlay">
          {scrollShadow}
          <PageError title="Ошибка каталога" text={error} />
        </div>

        <SlideMenu
          open={isSettingsMenuOpen}
          title="Настройки каталога"
          onClose={() => setIsSettingsMenuOpen(false)}
        >
          <p className="slide-menu__section-label">Отступы сетки</p>
          <ul className="slide-menu__list">
            {CATALOG_ROW_GAP_OPTIONS.map((option) => {
              const isActive = settings.catalogRowGap === option.id;

              return (
                <li key={option.id}>
                  <button
                    type="button"
                    className={`slide-menu__option${isActive ? ' slide-menu__option--active' : ''}`}
                    onClick={() => handleCatalogGapSelect(option.id)}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </SlideMenu>
      </div>
    );
  }

  return (
    <div className="browse-view">
      <div className="browse-view__header">
        <div className="browse-view__header-main">
          <div className="browse-view__title-group">
            <h1 className="browse-view__title">Каталог</h1>
            <button
              type="button"
              className="browse-view__settings-trigger"
              aria-label="Настройки каталога"
              onClick={openSettingsMenu}
            >
              <SettingsIcon size={22} />
            </button>
          </div>

          {tabs.length > 0 && (
            <>
              <span className="browse-view__divider" aria-hidden="true" />
              <Tabs
                items={tabs.map((tab) => ({ id: tab.id, label: tab.title }))}
                activeId={activeTab?.id ?? null}
                onChange={handleTabSelect}
                ariaLabel="Сортировка каталога"
              />
            </>
          )}
        </div>

        {categories.length > 0 ? (
          <button
            type="button"
            className="browse-view__category-trigger"
            onClick={openCategoryMenu}
          >
            {selectedCategory?.title ?? 'Категория'}
          </button>
        ) : isCategoriesLoading ? (
          <span className="browse-view__category-placeholder">...</span>
        ) : null}
      </div>

      <SlideMenu
        open={isCategoryMenuOpen}
        title="Категории"
        onClose={() => setIsCategoryMenuOpen(false)}
      >
        <ul className="slide-menu__list">
          {categories.map((category) => {
            const isActive = category.playlist_url === selectedCategory?.playlist_url;

            return (
              <li key={category.playlist_url}>
                <button
                  type="button"
                  className={`slide-menu__option${isActive ? ' slide-menu__option--active' : ''}`}
                  onClick={() => handleCategorySelect(category)}
                >
                  {category.title}
                </button>
              </li>
            );
          })}
        </ul>
      </SlideMenu>

      <SlideMenu
        open={isSettingsMenuOpen}
        title="Настройки каталога"
        onClose={() => setIsSettingsMenuOpen(false)}
      >
        <p className="slide-menu__section-label">Отступы сетки</p>
        <ul className="slide-menu__list">
          {CATALOG_ROW_GAP_OPTIONS.map((option) => {
            const isActive = settings.catalogRowGap === option.id;

            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={`slide-menu__option${isActive ? ' slide-menu__option--active' : ''}`}
                  onClick={() => handleCatalogGapSelect(option.id)}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      </SlideMenu>

      <div ref={scrollRef} className="browse-view__scroll scroll-overlay">
        {scrollShadow}
        {error && <p className="browse-view__error">{error}</p>}

        {isContentLoading && (
          <div className="page-state-overlay" aria-busy="true" aria-label="Загрузка каталога">
            <PageLoading />
          </div>
        )}

        <div className="browse-view__content" style={catalogGridStyle}>
          {isContentLoading ? null : items.length > 0 ? (
            <MediaGrid
              items={items}
              isLoadingMore={isLoadingMore}
              hasMore={Boolean(nextPageUrl)}
              onLoadMore={handleLoadMore}
              onMediaSelect={onMediaSelect}
            />
          ) : (
            <p className="browse-view__empty">В этой категории пока нет контента</p>
          )}
        </div>
      </div>
    </div>
  );
}
