import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import type { VokinoCategory } from '@/shared/api/vokino/types';
import {
  type BrowseTab,
  enrichBrowseTabs,
  fetchBrowseTabs,
  fetchPaginatedList,
  findBrowseCategoryByType,
  getDefaultBrowseCategory,
  mergeUniqueItems,
  sortBrowseCategories,
} from '@/shared/api/vokino/browse';
import { createBrowseFilterFields } from '@/features/browse/model/filterDefinitions';
import { useBrowseFilters } from '@/features/browse/model/useBrowseFilters';
import { BrowseFiltersPanel } from '@/features/browse/ui/BrowseFiltersPanel';
import '@/features/browse/ui/BrowseFiltersPanel.css';
import { vokinoRepository } from '@/shared/api/vokino/repository';
import {
  buildBrowseListUrlFromContext,
  buildBrowseScope,
  mergeBrowseFilters,
  type BrowseFilters,
} from '@/shared/api/vokino/browseQuery';
import { ensureMediaOverridesLoaded, hydrateMediaItems } from '@/shared/domain/overridesStore';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import {
  CATALOG_GAP_VALUES,
} from '@/shared/settings/types';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { playSubmenuSound } from '@/shared/audio/uiSounds';
import type { BrowseNavigationTarget } from '@/app/navigation/browseTarget';
import { PageError, PageLoading } from '@/shared/ui/PageState';
import { useAppTopProgress } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { FilterIcon, LayersIcon } from '@/shared/ui/icons';
import { SlideMenu } from '@/shared/ui/SlideMenu';
import { Tabs } from '@/shared/ui/Tabs';
import { BrowseSettingsPanels } from '@/features/browse/ui/BrowseSettingsPanels';
import { MediaGrid } from './MediaGrid';
import '@/components/SettingsView/SettingsView.css';
import './BrowseView.css';
import './MediaGrid.css';

interface BrowseViewProps {
  onMediaSelect: (item: MediaItem) => void;
  settingsMenuOpen: boolean;
  onSettingsMenuOpenChange: (open: boolean) => void;
  browseTarget?: BrowseNavigationTarget | null;
  onBrowseTargetConsumed?: () => void;
}

function pickDefaultTab(tabs: BrowseTab[]): BrowseTab | null {
  return tabs.find((tab) => tab.playlistUrl.includes('sort=popular')) ?? tabs[0] ?? null;
}

const BROWSE_CATEGORY_HINT_DURATION_MS = 6400;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function BrowseView({
  onMediaSelect,
  settingsMenuOpen,
  onSettingsMenuOpenChange,
  browseTarget = null,
  onBrowseTargetConsumed,
}: BrowseViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const requestIdRef = useRef(0);
  const bootstrapSessionRef = useRef(0);
  const browseTargetRef = useRef(browseTarget);
  browseTargetRef.current = browseTarget;
  const onBrowseTargetConsumedRef = useRef(onBrowseTargetConsumed);
  onBrowseTargetConsumedRef.current = onBrowseTargetConsumed;
  const { settings, isLoading, updateSettings } = useAppSettings();

  const [categories, setCategories] = useState<VokinoCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VokinoCategory | null>(null);
  const [tabs, setTabs] = useState<BrowseTab[]>([]);
  const [activeTab, setActiveTab] = useState<BrowseTab | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [isFiltersMenuOpen, setIsFiltersMenuOpen] = useState(false);
  const [isCategoryHintActive, setIsCategoryHintActive] = useState(false);
  const categoryHintStartedRef = useRef(false);

  useAppTopProgress('browse', isCategoriesLoading || isContentLoading, 'Загрузка каталога');

  const categoryHintEligible =
    !isLoading &&
    !settings.browseCategoryHintDismissed &&
    !prefersReducedMotion();

  const dismissCategoryHint = useCallback(() => {
    setIsCategoryHintActive(false);

    if (!settings.browseCategoryHintDismissed) {
      void updateSettings({ browseCategoryHintDismissed: true });
    }
  }, [settings.browseCategoryHintDismissed, updateSettings]);

  useEffect(() => {
    categoryHintStartedRef.current = false;
    setIsCategoryHintActive(false);
  }, [settings.browseCategoryHintDismissed]);

  useEffect(() => {
    if (!categoryHintEligible || categories.length === 0 || categoryHintStartedRef.current) {
      return;
    }

    categoryHintStartedRef.current = true;

    const delayId = window.setTimeout(() => {
      setIsCategoryHintActive(true);
    }, 700);

    return () => {
      window.clearTimeout(delayId);
    };
  }, [categoryHintEligible, categories.length]);

  useEffect(() => {
    if (!isCategoryHintActive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dismissCategoryHint();
    }, BROWSE_CATEGORY_HINT_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dismissCategoryHint, isCategoryHintActive]);

  const {
    filters,
    activeCount,
    setFilter,
    resetFilters,
  } = useBrowseFilters();

  const filterFields = useMemo(() => createBrowseFilterFields(), []);

  const filtersSupported = Boolean(
    selectedCategory && activeTab && buildBrowseScope(selectedCategory, activeTab),
  );

  const filtersContextLabel = useMemo(() => {
    if (!selectedCategory?.title || !activeTab?.title) {
      return 'Каталог';
    }

    return `${selectedCategory.title} · ${activeTab.title}`;
  }, [activeTab?.title, selectedCategory?.title]);

  const catalogGridStyle = {
    '--catalog-row-gap': `${CATALOG_GAP_VALUES[settings.catalogRowGap].row}px`,
    '--catalog-column-gap': `${CATALOG_GAP_VALUES[settings.catalogRowGap].column}px`,
  } as CSSProperties;

  const loadContent = useCallback(
    async (
      category: VokinoCategory,
      options?: {
        tab?: BrowseTab | null;
        pageUrl?: string | null;
        append?: boolean;
        filters?: BrowseFilters;
        manageLoading?: boolean;
      },
    ) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const append = options?.append ?? false;
      const manageLoading = options?.manageLoading ?? true;

      if (append) {
        setIsLoadingMore(true);
      } else if (manageLoading) {
        setIsContentLoading(true);
        setError(null);
        setItems([]);
        setNextPageUrl(null);
      }

      let enrichedTabs = tabs;
      let nextTab = activeTab;

      try {
        let playlistUrl = category.playlist_url;
        const pageUrl = options?.pageUrl ?? null;

        if (!append) {
          const categoryTabs = category.is_category === 1 ? await fetchBrowseTabs(category) : [];
          if (requestId !== requestIdRef.current) return;

          enrichedTabs = enrichBrowseTabs(categoryTabs, category);
          setTabs(enrichedTabs);

          nextTab = options?.tab ?? pickDefaultTab(enrichedTabs);
          setActiveTab(nextTab);

          if (nextTab) {
            const appliedFilters = options?.filters ?? filters;
            const builtUrl = buildBrowseListUrlFromContext(category, nextTab, appliedFilters);
            playlistUrl = builtUrl ?? nextTab.playlistUrl;
          }
        }

        const result = await fetchPaginatedList(playlistUrl, pageUrl);
        if (requestId !== requestIdRef.current) return;

        if (append) {
          setItems((current) => mergeUniqueItems(current, result.items));
          setNextPageUrl(result.nextUrl);
          return;
        }

        setItems(result.items);
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
        } else if (manageLoading) {
          setIsContentLoading(false);
        }
      }
    },
    [activeTab, filters, tabs],
  );

  useEffect(() => {
    if (settingsMenuOpen) {
      setIsCategoryMenuOpen(false);
      setIsFiltersMenuOpen(false);
    }
  }, [settingsMenuOpen]);

  const loadContentRef = useRef(loadContent);
  loadContentRef.current = loadContent;

  useEffect(() => {
    const sessionId = bootstrapSessionRef.current + 1;
    bootstrapSessionRef.current = sessionId;
    let cancelled = false;

    async function bootstrapCatalog() {
      const pendingTarget = browseTargetRef.current;

      setIsCategoriesLoading(true);
      setIsContentLoading(false);
      setError(null);

      try {
        const main = await vokinoRepository.getMain();
        if (cancelled || bootstrapSessionRef.current !== sessionId) {
          return;
        }

        const nextCategories = sortBrowseCategories(main.channels);
        const targetCategory = pendingTarget
          ? findBrowseCategoryByType(nextCategories, pendingTarget.categoryType)
          : null;
        const defaultCategory = getDefaultBrowseCategory(nextCategories);
        const category = targetCategory ?? defaultCategory;

        setCategories(nextCategories);
        setSelectedCategory(category);

        if (!category) {
          return;
        }

        if (targetCategory && pendingTarget) {
          onBrowseTargetConsumedRef.current?.();
        }

        setIsCategoriesLoading(false);
        setIsContentLoading(true);
        setItems([]);
        setNextPageUrl(null);

        await loadContentRef.current(category, {
          filters: {},
          manageLoading: false,
        });
      } catch (err) {
        if (!cancelled && bootstrapSessionRef.current === sessionId) {
          setError(err instanceof Error ? err.message : 'Не удалось загрузить каталог');
        }
      } finally {
        window.queueMicrotask(() => {
          if (!cancelled && bootstrapSessionRef.current === sessionId) {
            setIsCategoriesLoading(false);
            setIsContentLoading(false);
          }
        });
      }
    }

    void bootstrapCatalog();
    return () => {
      cancelled = true;
      bootstrapSessionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    void ensureMediaOverridesLoaded().then(() => {
      setItems((current) => (current.length > 0 ? hydrateMediaItems(current) : current));
    });
  }, []);

  const handleCategorySelect = (category: VokinoCategory) => {
    setSelectedCategory(category);
    setIsCategoryMenuOpen(false);
    setIsFiltersMenuOpen(false);
    void loadContent(category, { filters });
  };

  const catalogSettingsMenu = (
    <SlideMenu
      open={settingsMenuOpen}
      title="Настройки каталога"
      size="wide"
      onClose={() => onSettingsMenuOpenChange(false)}
    >
      <BrowseSettingsPanels variant="menu" />
    </SlideMenu>
  );

  const openCategoryMenu = () => {
    playSubmenuSound();
    dismissCategoryHint();
    onSettingsMenuOpenChange(false);
    setIsFiltersMenuOpen(false);
    setIsCategoryMenuOpen(true);
  };

  const openFiltersMenu = () => {
    playSubmenuSound();
    dismissCategoryHint();
    onSettingsMenuOpenChange(false);
    setIsCategoryMenuOpen(false);
    setIsFiltersMenuOpen(true);
  };

  const handleFiltersChange = (patch: Partial<BrowseFilters>) => {
    if (!selectedCategory || !activeTab) {
      return;
    }

    const nextFilters = mergeBrowseFilters(filters, patch);
    setFilter(patch);
    void loadContent(selectedCategory, { tab: activeTab, filters: nextFilters });
  };

  const handleFiltersReset = () => {
    if (!selectedCategory || !activeTab) {
      return;
    }

    resetFilters();
    void loadContent(selectedCategory, { tab: activeTab, filters: {} });
  };

  const handleTabSelect = (tabId: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!selectedCategory || !tab || tab.id === activeTab?.id) {
      return;
    }

    setActiveTab(tab);
    void loadContent(selectedCategory, { tab, filters });
  };

  const handleLoadMore = useCallback(() => {
    if (!selectedCategory || !nextPageUrl || isLoadingMore || isContentLoading) {
      return;
    }

    void loadContent(selectedCategory, { pageUrl: nextPageUrl, append: true });
  }, [selectedCategory, nextPageUrl, isLoadingMore, isContentLoading, loadContent]);

  if (error && categories.length === 0 && !isCategoriesLoading) {
    return (
      <div className="browse-view">
        <div ref={scrollRef} className="browse-view__scroll scroll-overlay">
          <PageError title="Ошибка каталога" text={error} />
        </div>

        {catalogSettingsMenu}
      </div>
    );
  }

  return (
    <div className="browse-view">
      <div className="browse-view__header">
        <div className="browse-view__header-main">
          {tabs.length > 0 ? (
            <Tabs
              items={tabs.map((tab) => ({ id: tab.id, label: tab.title }))}
              activeId={activeTab?.id ?? null}
              onChange={handleTabSelect}
              ariaLabel="Сортировка каталога"
            />
          ) : null}
        </div>

        {categories.length > 0 ? (
          <div className="browse-view__header-actions">
            <button
              type="button"
              className={`browse-view__filters-trigger${
                isFiltersMenuOpen ? ' browse-view__filters-trigger--open' : ''
              }${activeCount > 0 ? ' browse-view__filters-trigger--active' : ''}`}
              onClick={openFiltersMenu}
              disabled={!filtersSupported}
              aria-haspopup="dialog"
              aria-expanded={isFiltersMenuOpen}
              aria-label={
                activeCount > 0 ? `Фильтры, активно: ${activeCount}` : 'Фильтры'
              }
              title="Фильтры"
            >
              <FilterIcon size={22} strokeWidth={1.85} />
              {activeCount > 0 ? (
                <span className="browse-view__filters-badge" aria-hidden="true">
                  {activeCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              className={`browse-view__category-trigger${
                isCategoryMenuOpen ? ' browse-view__category-trigger--open' : ''
              }${isCategoryHintActive ? ' browse-view__category-trigger--hint' : ''}`}
              onClick={openCategoryMenu}
              aria-haspopup="dialog"
              aria-expanded={isCategoryMenuOpen}
              aria-label={`Категория: ${selectedCategory?.title ?? 'не выбрана'}`}
            >
              {isCategoryHintActive ? (
                <span className="browse-view__category-snake" aria-hidden="true">
                  <span className="browse-view__category-snake-ring">
                    <span className="browse-view__category-snake-track" />
                    <span className="browse-view__category-snake-draw" />
                    <span className="browse-view__category-snake-beam browse-view__category-snake-beam--trail" />
                    <span className="browse-view__category-snake-beam browse-view__category-snake-beam--core" />
                  </span>
                </span>
              ) : null}
              <LayersIcon size={22} strokeWidth={1.85} />
              <span className="browse-view__category-trigger-label" aria-hidden="true">
                <span className="browse-view__category-trigger-label-text">
                  {selectedCategory?.title ?? 'Категория'}
                </span>
              </span>
            </button>
          </div>
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
        open={isFiltersMenuOpen}
        title="Фильтры"
        size="xlarge"
        onClose={() => setIsFiltersMenuOpen(false)}
      >
        <BrowseFiltersPanel
          fields={filterFields}
          filters={filters}
          contextLabel={filtersContextLabel}
          onChange={handleFiltersChange}
          onReset={handleFiltersReset}
        />
      </SlideMenu>

      {catalogSettingsMenu}

      <div ref={scrollRef} className="browse-view__scroll scroll-overlay">
        {error && <p className="browse-view__error">{error}</p>}

        {isContentLoading ? (
          <div className="page-state-overlay" aria-busy="true" aria-label="Загрузка каталога">
            <PageLoading />
          </div>
        ) : null}

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
