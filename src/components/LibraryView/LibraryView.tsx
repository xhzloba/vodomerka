import { useMemo, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { FavoritesIcon, TrashIcon } from '@/shared/ui/icons';
import { ContentRow } from '../ContentRow/ContentRow';
import '../BrowseView/BrowseView.css';

interface LibraryViewProps {
  onMediaSelect: (item: MediaItem) => void;
}

export function LibraryView({ onMediaSelect }: LibraryViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
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

  if (isLoading) {
    return (
      <div className="library-view page-state-shell">
        <PageLoading title="Загрузка избранного..." centered />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="library-view scroll-overlay">
      <div className="library-view__header">
        <h1 className="library-view__title">Избранное</h1>
        {favorites.length > 0 ? (
          <button
            type="button"
            className="library-view__clear-btn"
            onClick={() => setConfirmOpen(true)}
          >
            <TrashIcon size={16} strokeWidth={1.75} />
            Очистить всё
          </button>
        ) : null}
      </div>

      {favorites.length === 0 ? (
        <div className="library-view__empty">
          <div className="library-view__empty-icon">
            <FavoritesIcon size={48} strokeWidth={1.5} />
          </div>
          <p className="library-view__empty-text">Сохранённые фильмы и сериалы появятся здесь</p>
        </div>
      ) : (
        <div className="library-view__rows">
          <ContentRow title="ВСЕ" items={favorites} onMediaSelect={onMediaSelect} />
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
        </div>
      )}

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
    </div>
  );
}
