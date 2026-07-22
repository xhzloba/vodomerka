import { useEffect, useMemo, useState } from 'react';
import { TOP250_COMPILATION_TARGET, type CompilationNavigationTarget } from '@/app/navigation/compilationTarget';
import { useHomePage } from '@/features/home/model/useHomePage';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import type { ContentRow as ContentRowData, MediaItem } from '@/shared/domain/media';
import {
  getHiddenHomeSectionIds,
  hideHomeSection,
  HOME_FAVORITES_SECTION_ID,
  HOME_FAVORITES_SECTION_TITLE,
  HOME_RECENTLY_VIEWED_SECTION_ID,
  HOME_RECENTLY_VIEWED_SECTION_TITLE,
  isTop250HomeRow,
  isTrendingHomeRow,
  orderVisibleHomeRows,
  resolveHeroItems,
  resolveHeroSourceSectionIds,
  shouldShowHomeFavoritesSection,
  shouldShowHomeRecentlyViewedSection,
} from '@/shared/domain/homeSections';
import { playSubmenuSound } from '@/shared/audio/uiSounds';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { FavoritesIcon, HistoryIcon } from '@/shared/ui/icons';
import { useAppTopProgress } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { PageError, PageLoading } from '@/shared/ui/PageState';
import { HeroBanner } from '../HeroBanner/HeroBanner';
import { ContentRow } from '../ContentRow/ContentRow';
import { getHomeRowIcon } from './homeRowIcon';
import './HomeView.css';

interface HomeViewProps {
  onMediaSelect: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  onOpenCompilation?: (target: CompilationNavigationTarget) => void;
}

export function HomeView({ onMediaSelect, onPlay, onOpenCompilation }: HomeViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const { settings, updateSettings } = useAppSettings();
  const { showToast } = useToast();
  const { favorites } = useFavorites();
  const { recentlyViewed } = useRecentlyViewed();
  const { data, isLoading, isError, error, reload, isRefreshing } = useHomePage();

  useAppTopProgress(
    'home',
    isLoading || isRefreshing,
    isRefreshing ? 'Обновление главной' : 'Загрузка главной',
  );
  const [hideConfirmSection, setHideConfirmSection] = useState<{ id: string; title: string } | null>(
    null,
  );

  useEffect(() => {
    if (!data?.rows.length) {
      return;
    }

    const resolved = resolveHeroSourceSectionIds(data.rows, settings.heroSourceSectionIds);
    if (resolved.length === 0) {
      return;
    }

    const current = settings.heroSourceSectionIds;
    if (current.length === 1 && current[0] === resolved[0]) {
      return;
    }

    void updateSettings({ heroSourceSectionIds: resolved });
  }, [data?.rows, settings.heroSourceSectionIds, updateSettings]);

  const hiddenSectionIds = useMemo(
    () =>
      getHiddenHomeSectionIds(
        settings.hiddenHomeSections,
        settings.homeSectionRestoreOrder,
        data?.rows ?? [],
      ),
    [data?.rows, settings.hiddenHomeSections, settings.homeSectionRestoreOrder],
  );

  const visibleRows = useMemo(
    () =>
      orderVisibleHomeRows(
        data?.rows ?? [],
        hiddenSectionIds,
        settings.homeSectionRestoreOrder,
      ),
    [data?.rows, hiddenSectionIds, settings.homeSectionRestoreOrder],
  );

  const showFavoritesSection = shouldShowHomeFavoritesSection(
    settings.homeFavoritesSection,
    favorites.length,
    hiddenSectionIds,
  );

  const showRecentlyViewedSection = shouldShowHomeRecentlyViewedSection(
    settings.homeRecentlyViewedSection,
    recentlyViewed.length,
    hiddenSectionIds,
  );

  const heroItems = useMemo(
    () => resolveHeroItems(data?.rows ?? [], settings.heroSourceSectionIds),
    [data?.rows, settings.heroSourceSectionIds],
  );

  const requestHideSection = (section: { id: string; title: string }) => {
    playSubmenuSound();
    setHideConfirmSection(section);
  };

  const confirmHideSection = () => {
    if (!hideConfirmSection) {
      return;
    }

    const next = hideHomeSection(
      settings.hiddenHomeSections,
      settings.homeSectionRestoreOrder,
      hideConfirmSection,
    );

    showToast(`Секция «${hideConfirmSection.title}» скрыта`, { kind: 'hide', title: 'Скрыто' });
    setHideConfirmSection(null);
    void updateSettings(next);
  };

  const handleHideRow = (row: ContentRowData) => {
    if (isTrendingHomeRow(row)) {
      return;
    }

    requestHideSection({ id: row.id, title: row.title });
  };

  if (isLoading) {
    return (
      <div className="page-state-shell">
        <PageLoading centered />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div ref={scrollRef} className="home-view scroll-overlay">
        <PageError
          title="Не удалось загрузить главную"
          text={error ?? 'Проверьте подключение к интернету и попробуйте снова.'}
          onAction={() => void reload()}
        />
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div ref={scrollRef} className="home-view scroll-overlay">
        <PageError
          title="Контент не найден"
          text="API ответило, но ряды пустые. Попробуйте обновить страницу."
          onAction={() => void reload()}
        />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="home-view scroll-overlay">
      {settings.heroEnabled && heroItems.length ? (
        <HeroBanner
          items={heroItems}
          autoSlide={settings.heroAutoSlide}
          slideIntervalSec={settings.heroSlideIntervalSec}
          onPlay={onPlay}
          onInfo={onMediaSelect}
        />
      ) : null}

      <div
        className={`home-view__content${settings.heroEnabled ? '' : ' home-view__content--no-hero'}`}
      >
        {showFavoritesSection ? (
          <ContentRow
            title={HOME_FAVORITES_SECTION_TITLE}
            icon={<FavoritesIcon size={22} />}
            items={favorites}
            onMediaSelect={onMediaSelect}
            onHide={() =>
              requestHideSection({
                id: HOME_FAVORITES_SECTION_ID,
                title: HOME_FAVORITES_SECTION_TITLE,
              })
            }
          />
        ) : null}

        {showRecentlyViewedSection ? (
          <ContentRow
            title={HOME_RECENTLY_VIEWED_SECTION_TITLE}
            icon={<HistoryIcon size={22} />}
            items={recentlyViewed}
            onMediaSelect={onMediaSelect}
            onHide={() =>
              requestHideSection({
                id: HOME_RECENTLY_VIEWED_SECTION_ID,
                title: HOME_RECENTLY_VIEWED_SECTION_TITLE,
              })
            }
          />
        ) : null}

        {visibleRows.map((row) => (
          <ContentRow
            key={row.id}
            title={row.title}
            icon={getHomeRowIcon(row)}
            items={row.items}
            onTitleClick={
              isTop250HomeRow(row) ? () => onOpenCompilation?.(TOP250_COMPILATION_TARGET) : undefined
            }
            onMediaSelect={onMediaSelect}
            onHide={isTrendingHomeRow(row) ? undefined : () => handleHideRow(row)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={hideConfirmSection !== null}
        title="Скрыть секцию?"
        description={
          hideConfirmSection
            ? `Секция «${hideConfirmSection.title}» будет скрыта с главной. Вернуть её можно в настройках.`
            : ''
        }
        confirmLabel="Скрыть"
        cancelLabel="Отмена"
        confirmVariant="neutral"
        onCancel={() => setHideConfirmSection(null)}
        onConfirm={confirmHideSection}
      />
    </div>
  );
}
