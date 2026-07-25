import { useMemo, useState, type ReactNode } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { useWatched } from '@/shared/domain/WatchedContext';
import {
  WATCH_STATUS_CLEAR_COPY,
  WATCH_STATUS_EMPTY_HINTS,
  WATCH_STATUS_LABELS,
  type WatchStatus,
} from '@/shared/domain/watchStatus';
import { playDeleteSound } from '@/shared/audio/uiSounds';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { LibraryCollectionView } from '../LibraryCollectionView/LibraryCollectionView';
import { ContentRow } from '../ContentRow/ContentRow';

interface WatchStatusCollectionViewProps {
  status: WatchStatus;
  emptyIcon: ReactNode;
  onMediaSelect: (item: MediaItem) => void;
  isActive?: boolean;
}

export function WatchStatusCollectionView({
  status,
  emptyIcon,
  onMediaSelect,
  isActive = true,
}: WatchStatusCollectionViewProps) {
  const { listByStatus, isLoading, clearBucket } = useWatched();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const items = useMemo(() => listByStatus(status), [listByStatus, status]);
  const { movies, serials } = useMemo(
    () => ({
      movies: items.filter(isMovieMedia),
      serials: items.filter(isSerialMedia),
    }),
    [items],
  );

  const copy = WATCH_STATUS_CLEAR_COPY[status];
  const title = WATCH_STATUS_LABELS[status];

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearBucket(status);
      playDeleteSound();
      setConfirmOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <LibraryCollectionView
        title={title}
        isLoading={isLoading}
        loadingTitle={copy.loadingTitle}
        hasItems={items.length > 0}
        clearAriaLabel={copy.ariaLabel}
        onClearRequest={() => setConfirmOpen(true)}
        emptyIcon={emptyIcon}
        emptyText={WATCH_STATUS_EMPTY_HINTS[status]}
        isActive={isActive}
      >
        <ContentRow title="ВСЕ" items={items} onMediaSelect={onMediaSelect} />
        {movies.length > 0 ? (
          <ContentRow
            title="Фильмы"
            titleCount={movies.length}
            items={movies}
            onMediaSelect={onMediaSelect}
          />
        ) : null}
        {serials.length > 0 ? (
          <ContentRow
            title="Сериалы"
            titleCount={serials.length}
            items={serials}
            onMediaSelect={onMediaSelect}
          />
        ) : null}
      </LibraryCollectionView>

      <ConfirmDialog
        open={confirmOpen}
        title={copy.title}
        description={copy.description}
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
