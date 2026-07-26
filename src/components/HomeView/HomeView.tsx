import { useCallback, useEffect, useMemo, useState } from 'react';
import { TOP250_COMPILATION_TARGET, type CompilationNavigationTarget } from '@/app/navigation/compilationTarget';
import { useHomePage } from '@/features/home/model/useHomePage';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { useContinueWatching } from '@/shared/domain/ContinueWatchingContext';
import { isContinueSerialRecord } from '@/shared/domain/continueWatchingProgress';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { usePlayer } from '@/shared/domain/PlayerContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import { useTorrents } from '@/shared/domain/TorrentsContext';
import type { ContentRow as ContentRowData, MediaItem } from '@/shared/domain/media';
import {
  getHiddenHomeSectionIds,
  hideHomeSection,
  HOME_CONTINUE_SECTION_ID,
  HOME_CONTINUE_SECTION_TITLE,
  HOME_FAVORITES_SECTION_ID,
  HOME_FAVORITES_SECTION_TITLE,
  HOME_RECENTLY_VIEWED_SECTION_ID,
  HOME_RECENTLY_VIEWED_SECTION_TITLE,
  isTop250HomeRow,
  isTrendingHomeRow,
  orderVisibleHomeRows,
  resolveHeroItems,
  resolveHeroSourceSectionIds,
  shouldShowHomeContinueSection,
  shouldShowHomeFavoritesSection,
  shouldShowHomeRecentlyViewedSection,
} from '@/shared/domain/homeSections';
import { playSubmenuSound } from '@/shared/audio/uiSounds';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { Tabs } from '@/shared/ui/Tabs';
import { FavoritesIcon, HistoryIcon, PlayIcon } from '@/shared/ui/icons';
import { useAppTopProgress } from '@/shared/ui/AppTopProgress/AppTopProgressContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { PageError, PageLoading } from '@/shared/ui/PageState';
import { HeroBanner } from '../HeroBanner/HeroBanner';
import { ContentRow } from '../ContentRow/ContentRow';
import { getHomeRowIcon } from './homeRowIcon';
import './HomeView.css';

type MediaTypeFilter = 'all' | 'movie' | 'serial';

const MEDIA_TYPE_FILTER_TABS: Array<{ id: MediaTypeFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'movie', label: 'Фильмы' },
  { id: 'serial', label: 'Сериалы' },
];

function isSerialMediaItem(item: MediaItem): boolean {
  return item.type === 'serial' || /serial|сериал/i.test(item.type);
}

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
  const { items: continueItems, records: continueRecords, findByMediaId } = useContinueWatching();
  const { torrents } = useTorrents();
  const { playTorrent } = usePlayer();
  const { data, isLoading, isError, error, reload, isRefreshing } = useHomePage();

  useAppTopProgress(
    'home',
    isLoading || isRefreshing,
    isRefreshing ? 'Обновление главной' : 'Загрузка главной',
  );
  const [hideConfirmSection, setHideConfirmSection] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [continueTypeFilter, setContinueTypeFilter] = useState<MediaTypeFilter>('all');
  const [recentTypeFilter, setRecentTypeFilter] = useState<MediaTypeFilter>('all');

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

  const showContinueSection = shouldShowHomeContinueSection(
    settings.homeContinueWatchingSection,
    continueItems.length,
    hiddenSectionIds,
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

  const filteredContinueItems = useMemo(() => {
    if (continueTypeFilter === 'all') {
      return continueItems;
    }
    return continueRecords
      .filter((record) => {
        const serial = isContinueSerialRecord(record);
        return continueTypeFilter === 'serial' ? serial : !serial;
      })
      .map((record) => record.item);
  }, [continueItems, continueRecords, continueTypeFilter]);

  const filteredRecentlyViewed = useMemo(() => {
    if (recentTypeFilter === 'all') {
      return recentlyViewed;
    }
    return recentlyViewed.filter((item) => {
      const serial = isSerialMediaItem(item);
      return recentTypeFilter === 'serial' ? serial : !serial;
    });
  }, [recentTypeFilter, recentlyViewed]);

  const handleContinueSelect = useCallback(
    async (item: MediaItem) => {
      const record =
        continueRecords.find((entry) => entry.item.id === item.id) ?? findByMediaId(item.id);
      if (!record?.torrentId) {
        onMediaSelect(item);
        return;
      }

      const torrent = torrents.find((entry) => entry.id === record.torrentId);
      if (!torrent) {
        onMediaSelect(item);
        return;
      }

      const result = await playTorrent(
        record.torrentId,
        record.filePath,
        record.positionSeconds > 0 ? record.positionSeconds : undefined,
      );
      if (!result.ok) {
        showToast(result.error || 'Не удалось продолжить просмотр', {
          kind: 'error',
          title: 'Плеер',
        });
        onMediaSelect(item);
      }
    },
    [
      continueRecords,
      findByMediaId,
      onMediaSelect,
      playTorrent,
      showToast,
      torrents,
    ],
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
        {showContinueSection ? (
          <ContentRow
            title={HOME_CONTINUE_SECTION_TITLE}
            icon={<PlayIcon size={22} />}
            items={filteredContinueItems}
            headerExtra={
              <Tabs
                items={MEDIA_TYPE_FILTER_TABS}
                activeId={continueTypeFilter}
                onChange={(id) => setContinueTypeFilter(id as MediaTypeFilter)}
                ariaLabel="Фильтр продолжить просмотр"
                variant="segmented"
              />
            }
            onMediaSelect={(item) => {
              void handleContinueSelect(item);
            }}
            onHide={() =>
              requestHideSection({
                id: HOME_CONTINUE_SECTION_ID,
                title: HOME_CONTINUE_SECTION_TITLE,
              })
            }
          />
        ) : null}

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
            items={filteredRecentlyViewed}
            headerExtra={
              <Tabs
                items={MEDIA_TYPE_FILTER_TABS}
                activeId={recentTypeFilter}
                onChange={(id) => setRecentTypeFilter(id as MediaTypeFilter)}
                ariaLabel="Фильтр истории просмотров"
                variant="segmented"
              />
            }
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
