import { useMemo, useState, type ReactNode } from 'react';
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
  WatchingIcon,
} from '@/shared/ui/icons';
import { LibraryCollectionView } from '../LibraryCollectionView/LibraryCollectionView';
import { LibraryTypeFilteredRows } from '../LibraryCollectionView/LibraryTypeFilteredRows';

export type CollectionTab = 'favorites' | WatchStatus;

const COLLECTION_TABS: Array<{ id: CollectionTab; label: string }> = [
  { id: 'favorites', label: 'Избранное' },
  ...WATCH_STATUSES.map((status) => ({
    id: status,
    label: WATCH_STATUS_LABELS[status],
  })),
];

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

  const statusItems = useMemo(
    () => (tab === 'favorites' ? [] : listByStatus(tab)),
    [listByStatus, tab],
  );

  const items = tab === 'favorites' ? favorites : statusItems;
  const isLoading = tab === 'favorites' ? favoritesLoading : statusesLoading;

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
      <LibraryCollectionView
        title="Коллекция"
        headerExtra={
          <Tabs
            items={COLLECTION_TABS}
            activeId={tab}
            onChange={(id) => setTab(id as CollectionTab)}
            ariaLabel="Разделы коллекции"
            variant="segmented"
          />
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
          filterAriaLabel="Фильтр коллекции по типу"
        />
      </LibraryCollectionView>

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
