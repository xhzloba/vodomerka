import { useMemo, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { useWatched } from '@/shared/domain/WatchedContext';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { PageLoading } from '@/shared/ui/PageState';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog/ConfirmDialog';
import { EyeIcon, TrashIcon } from '@/shared/ui/icons';
import { ContentRow } from '../ContentRow/ContentRow';
import '../BrowseView/BrowseView.css';

interface WatchedViewProps {
  onMediaSelect: (item: MediaItem) => void;
}

export function WatchedView({ onMediaSelect }: WatchedViewProps) {
  const scrollRef = useOverlayScroll<HTMLDivElement>();
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

  if (isLoading) {
    return (
      <div className="library-view page-state-shell">
        <PageLoading title="Загрузка просмотренного..." centered />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="library-view scroll-overlay">
      <div className="library-view__header">
        <h1 className="library-view__title">Просмотренное</h1>
        {watched.length > 0 ? (
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

      {watched.length === 0 ? (
        <div className="library-view__empty">
          <div className="library-view__empty-icon">
            <EyeIcon size={48} strokeWidth={1.5} />
          </div>
          <p className="library-view__empty-text">
            Отмечайте фильмы и сериалы в деталке — они появятся здесь
          </p>
        </div>
      ) : (
        <div className="library-view__rows">
          <ContentRow title="ВСЕ" items={watched} onMediaSelect={onMediaSelect} />
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
    </div>
  );
}
