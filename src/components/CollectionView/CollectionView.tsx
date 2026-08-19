import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import {
  WATCH_STATUS_CLEAR_COPY,
  WATCH_STATUS_EMPTY_HINTS,
  WATCH_STATUS_LABELS,
  WATCH_STATUSES,
  type WatchStatus,
} from '@/shared/domain/watchStatus';
import { playDeleteSound } from '@/shared/audio/uiSounds';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { Tabs } from '@/shared/ui/Tabs';
import {
  BanIcon,
  EyeIcon,
  FavoritesIcon,
  PauseCircleIcon,
  SettingsIcon,
  WatchingIcon,
} from '@/shared/ui/icons';
import { LibraryCollectionView } from '../LibraryCollectionView/LibraryCollectionView';
import { LibraryTypeFilteredRows } from '../LibraryCollectionView/LibraryTypeFilteredRows';
import './CollectionViewFavoritesBackdrop.css';

export type CollectionTab = 'favorites' | WatchStatus;

interface CollectionViewProps {
  onMediaSelect: (item: MediaItem) => void;
  isActive?: boolean;
}

function tabEmptyIcon(tab: CollectionTab): ReactNode {
  switch (tab) {
    case 'favorites':
      return <FavoritesIcon size={48} strokeWidth={1.5} />;
    case 'watching':
      return <WatchingIcon size={48} strokeWidth={1.5} />;
    case 'watched':
      return <EyeIcon size={48} strokeWidth={1.5} />;
    case 'postponed':
      return <PauseCircleIcon size={48} strokeWidth={1.5} />;
    case 'dropped':
      return <BanIcon size={48} strokeWidth={1.5} />;
  }
}

export function CollectionView({ onMediaSelect, isActive = true }: CollectionViewProps) {
  const { favorites, isLoading: favoritesLoading, clearAllFavorites } = useFavorites();
  const {
    listByStatus,
    isLoading: statusesLoading,
    clearBucket,
  } = useWatched();
  const [tab, setTab] = useState<CollectionTab>('favorites');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [favoritesBackdropEnabled, setFavoritesBackdropEnabled] = useState(true);
  const [favoritesBackdropIndex, setFavoritesBackdropIndex] = useState(0);
  const [favoritesVisibleItems, setFavoritesVisibleItems] = useState<MediaItem[]>([]);

  const collectionTabs = useMemo(
    () => [
      { id: 'favorites' as const, label: 'Избранное', count: favorites.length },
      ...WATCH_STATUSES.map((status) => ({
        id: status,
        label: WATCH_STATUS_LABELS[status],
        count: listByStatus(status).length,
      })),
    ],
    [favorites.length, listByStatus],
  );

  const statusItems = useMemo(
    () => (tab === 'favorites' ? [] : listByStatus(tab)),
    [listByStatus, tab],
  );

  const items = tab === 'favorites' ? favorites : statusItems;
  const isLoading = tab === 'favorites' ? favoritesLoading : statusesLoading;

  const favoriteBackdrops = useMemo(() => {
    const urls = favoritesVisibleItems
      .map((item) => item.backdrop)
      .filter((url) => Boolean(url));
    return Array.from(new Set(urls));
  }, [favoritesVisibleItems]);

  useEffect(() => {
    if (tab !== 'favorites') {
      setFavoritesBackdropIndex(0);
      return;
    }

    if (!favoritesBackdropEnabled) {
      return;
    }

    if (favoriteBackdrops.length <= 1) {
      setFavoritesBackdropIndex(0);
      return;
    }

    setFavoritesBackdropIndex(0);

    const id = window.setInterval(() => {
      setFavoritesBackdropIndex((current) => (current + 1) % favoriteBackdrops.length);
    }, 5000);

    return () => window.clearInterval(id);
  }, [favoriteBackdrops, favoritesBackdropEnabled, tab]);

  const activeFavoriteBackdrop = favoriteBackdrops[favoritesBackdropIndex] ?? favoriteBackdrops[0] ?? '';

  useEffect(() => {
    if (tab !== 'favorites') {
      setFavoritesVisibleItems([]);
    }
  }, [tab]);

  const clearCopy =
    tab === 'favorites'
      ? {
          title: 'Очистить избранное?',
          description:
            'Все сохранённые фильмы и сериалы будут удалены из базы данных без возможности восстановления.',
          ariaLabel: 'Очистить избранное',
          loadingTitle: 'Загрузка избранного...',
        }
      : WATCH_STATUS_CLEAR_COPY[tab];

  const emptyText =
    tab === 'favorites'
      ? 'Сохранённые фильмы и сериалы появятся здесь'
      : WATCH_STATUS_EMPTY_HINTS[tab];

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      if (tab === 'favorites') {
        await clearAllFavorites();
      } else {
        await clearBucket(tab);
      }
      playDeleteSound();
      setConfirmOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <div className="collection-favorites-hero">
        {tab === 'favorites' && favoritesBackdropEnabled && activeFavoriteBackdrop ? (
          <div className="collection-favorites-hero__backdrop" aria-hidden="true">
            <div className="collection-favorites-hero__image-panel">
              <img
                key={activeFavoriteBackdrop}
                className="collection-favorites-hero__backdrop-image collection-favorites-hero__backdrop-image--enter"
                src={activeFavoriteBackdrop}
                alt=""
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        ) : null}

        <LibraryCollectionView
          title="Моё"
          titleRightExtra={
            tab === 'favorites' && favoriteBackdrops.length > 0 ? (
              <button
                type="button"
                className={`collection-favorites-hero__backdrop-toggle${
                  favoritesBackdropEnabled ? '' : ' collection-favorites-hero__backdrop-toggle--off'
                }`}
                aria-label={favoritesBackdropEnabled ? 'Отключить фон' : 'Включить фон'}
                aria-pressed={favoritesBackdropEnabled}
                onClick={() => setFavoritesBackdropEnabled((v) => !v)}
                title="Фон по backdrop"
              >
                <SettingsIcon size={18} />
              </button>
            ) : null
          }
          headerExtra={
            <div className="collection-favorites-hero__header-extra">
              <Tabs
                items={collectionTabs}
                activeId={tab}
                onChange={(id) => setTab(id as CollectionTab)}
                ariaLabel="Разделы в Моё"
                variant="segmented"
              />
            </div>
          }
          scrollKey={tab}
          isLoading={isLoading}
          loadingTitle={clearCopy.loadingTitle}
          hasItems={items.length > 0}
          clearAriaLabel={clearCopy.ariaLabel}
          onClearRequest={() => setConfirmOpen(true)}
          emptyIcon={tabEmptyIcon(tab)}
          emptyText={emptyText}
          isActive={isActive}
        >
          <LibraryTypeFilteredRows
            key={tab}
            items={items}
            onMediaSelect={onMediaSelect}
            filterAriaLabel="Фильтр Моё по типу"
            onVisibleItemsChange={
              tab === 'favorites' ? (visible) => setFavoritesVisibleItems(visible) : undefined
            }
          />
        </LibraryCollectionView>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={clearCopy.title}
        description={clearCopy.description}
        confirmLabel="Очистить"
        cancelLabel="Отмена"
        confirmVariant="danger"
        isConfirming={isClearing}
        onCancel={() => {
          if (!isClearing) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={() => void handleClearAll()}
      />
    </>
  );
}
