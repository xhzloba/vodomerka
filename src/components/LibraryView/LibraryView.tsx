import { useMemo, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { FavoritesIcon } from '@/shared/ui/icons';
import { LibraryCollectionView } from '../LibraryCollectionView/LibraryCollectionView';
import { ContentRow } from '../ContentRow/ContentRow';

interface LibraryViewProps {
  onMediaSelect: (item: MediaItem) => void;
}

export function LibraryView({ onMediaSelect }: LibraryViewProps) {
  const { favorites, isLoading, clearAllFavorites } = useFavorites();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { movies, serials } = useMemo(
    () => ({
      movies: favorites.filter(isMovieMedia),
      serials: favorites.filter(isSerialMedia),
    }),
    [favorites],
  );

  const handleClearAll = async () => {
    setIsClearing(true);

    try {
      await clearAllFavorites();
      setConfirmOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <LibraryCollectionView
        title="Избранное"
        isLoading={isLoading}
        loadingTitle="Загрузка избранного..."
        hasItems={favorites.length > 0}
        clearAriaLabel="Очистить избранное"
        onClearRequest={() => setConfirmOpen(true)}
        emptyIcon={<FavoritesIcon size={48} strokeWidth={1.5} />}
        emptyText="Сохранённые фильмы и сериалы появятся здесь"
      >
        <ContentRow title="ВСЕ" items={favorites} onMediaSelect={onMediaSelect} edgeFade />
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
        title="Очистить избранное?"
        description="Все сохранённые фильмы и сериалы будут удалены из базы данных без возможности восстановления."
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
