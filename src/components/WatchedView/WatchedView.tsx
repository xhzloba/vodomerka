import { useMemo, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { useWatched } from '@/shared/domain/WatchedContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { EyeIcon } from '@/shared/ui/icons';
import { LibraryCollectionView } from '../LibraryCollectionView/LibraryCollectionView';
import { ContentRow } from '../ContentRow/ContentRow';

interface WatchedViewProps {
  onMediaSelect: (item: MediaItem) => void;
}

export function WatchedView({ onMediaSelect }: WatchedViewProps) {
  const { watched, isLoading, clearAllWatched } = useWatched();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { movies, serials } = useMemo(
    () => ({
      movies: watched.filter(isMovieMedia),
      serials: watched.filter(isSerialMedia),
    }),
    [watched],
  );

  const handleClearAll = async () => {
    setIsClearing(true);

    try {
      await clearAllWatched();
      setConfirmOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <LibraryCollectionView
        title="Просмотренное"
        isLoading={isLoading}
        loadingTitle="Загрузка просмотренного..."
        hasItems={watched.length > 0}
        clearAriaLabel="Очистить просмотренное"
        onClearRequest={() => setConfirmOpen(true)}
        emptyIcon={<EyeIcon size={48} strokeWidth={1.5} />}
        emptyText="Отмечайте фильмы и сериалы в деталке — они появятся здесь"
      >
        <ContentRow title="ВСЕ" items={watched} onMediaSelect={onMediaSelect} edgeFade />
        {movies.length > 0 ? (
          <ContentRow
            title="Фильмы"
            titleCount={movies.length}
            items={movies}
            onMediaSelect={onMediaSelect}
            edgeFade
          />
        ) : null}
        {serials.length > 0 ? (
          <ContentRow
            title="Сериалы"
            titleCount={serials.length}
            items={serials}
            onMediaSelect={onMediaSelect}
            edgeFade
          />
        ) : null}
      </LibraryCollectionView>

      <ConfirmDialog
        open={confirmOpen}
        title="Очистить просмотренное?"
        description="Все отмеченные фильмы и сериалы будут удалены из базы данных без возможности восстановления."
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
