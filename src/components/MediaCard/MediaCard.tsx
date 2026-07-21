import { useCallback, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useMediaDrag, writeMediaDragData, hideNativeDragImage } from '@/shared/domain/MediaDragContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { unlockUiSounds } from '@/shared/audio/uiSounds';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { ContextMenu } from '@/shared/ui/ContextMenu/ContextMenu';
import {
  getMediaContextMenuItems,
  MediaContextMenuHeader,
} from '@/shared/ui/mediaContextMenu';
import { MediaCoverPlaceholder } from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';
import { MediaDescriptionDialog } from '@/shared/ui/MediaDescriptionDialog/MediaDescriptionDialog';
import { copyText } from '@/shared/lib/copyText';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { EyeOffIcon, FavoritesIcon, PlayOverlayIcon } from '@/shared/ui/icons';
import './MediaCard.css';

interface MediaCardProps {
  item: MediaItem;
  variant?: 'poster' | 'wide';
  isFocused?: boolean;
  onSelect: (item: MediaItem) => void;
}

export function MediaCard({ item, variant = 'poster', isFocused, onSelect }: MediaCardProps) {
  const { settings } = useAppSettings();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isWatched, toggleWatched } = useWatched();
  const { beginMediaDrag, endMediaDrag } = useMediaDrag();
  const { showToast } = useToast();
  const cardRef = useRef<HTMLElement>(null);
  const suppressClickRef = useRef(false);
  const inFavorites = isFavorite(item.id);
  const watched = isWatched(item.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const copyMediaId = useCallback(async () => {
    const ok = await copyText(item.id);
    showToast(ok ? item.id : 'Не удалось скопировать ID', {
      kind: 'copy',
      title: ok ? 'ID скопирован' : 'Ошибка',
    });
  }, [item.id, showToast]);

  const handleContextMenuItem = useCallback(
    (menuItemId: string) => {
      switch (menuItemId) {
        case 'details':
          onSelect(item);
          break;
        case 'description':
          if (item.description || item.genres.length > 0) {
            setDescriptionOpen(true);
          }
          break;
        case 'copy-id':
          void copyMediaId();
          break;
        case 'favorite':
          void toggleFavorite(item).then((added) => {
            showToast(
              added ? `«${item.title}» в избранном` : `«${item.title}» убрано из избранного`,
              {
                kind: 'favorite',
                title: added ? 'Добавлено' : 'Удалено',
              },
            );
          });
          break;
        case 'watched':
          void toggleWatched(item).then((added) => {
            showToast(
              added ? `«${item.title}» в просмотренном` : `«${item.title}» убрано из просмотренного`,
              {
                kind: added ? 'restore' : 'hide',
                title: added ? 'Просмотрено' : 'Убрано',
              },
            );
          });
          break;
        default:
          break;
      }
    },
    [copyMediaId, item, onSelect, showToast, toggleFavorite, toggleWatched],
  );

  const handlePointerDown = useCallback((_event: PointerEvent<HTMLElement>) => {
    // Жест мыши раньше dragstart — иначе Electron глотает HTMLAudio после DnD
    unlockUiSounds();
  }, []);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLElement>) => {
      suppressClickRef.current = true;
      setIsDragging(true);
      closeContextMenu();
      unlockUiSounds();
      writeMediaDragData(event.dataTransfer, item);
      hideNativeDragImage(event.dataTransfer);

      const poster = cardRef.current?.querySelector('.media-card__poster') as HTMLImageElement | null;
      const wrap = cardRef.current?.querySelector('.media-card__poster-wrap') as HTMLElement | null;
      const rect = (poster ?? wrap ?? cardRef.current)?.getBoundingClientRect();

      beginMediaDrag(
        item,
        {
          posterUrl: poster?.currentSrc || poster?.src || item.poster || undefined,
          width: Math.round(rect?.width || 120),
          height: Math.round(rect?.height || 180),
        },
        { x: event.clientX, y: event.clientY },
        rect
          ? {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
            }
          : undefined,
      );
    },
    [beginMediaDrag, closeContextMenu, item],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    endMediaDrag('return');
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }, [endMediaDrag]);

  const primaryUrl = variant === 'wide' ? item.backdrop || item.poster : item.poster;
  const fallbackUrl = variant === 'wide' ? item.poster : item.backdrop;
  const hasImageSource = Boolean(primaryUrl || fallbackUrl);

  const { src, failed, ready, loading, onError } = useMediaImage({
    primaryUrl,
    fallbackUrl,
    rootRef: cardRef,
  });

  const showImage = hasImageSource && !failed && ready;
  const isLoading = hasImageSource && !failed && !ready;
  const isEmptyCard = !hasImageSource || failed;

  const metaParts = [
    item.year,
    item.rating != null ? `★ ${item.rating.toFixed(1)}` : null,
  ].filter(Boolean);

  return (
    <>
      <article
        ref={cardRef}
        className={`media-card ${variant === 'wide' ? 'media-card--wide' : ''} ${isFocused ? 'media-card--focused' : ''}${isEmptyCard && !isLoading ? ' media-card--empty' : ''}${isDragging ? ' media-card--dragging' : ''}`}
        draggable
        onPointerDown={handlePointerDown}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (suppressClickRef.current) {
            return;
          }
          closeContextMenu();
          onSelect(item);
        }}
        onContextMenu={handleContextMenu}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(item);
          }
        }}
      >
        <div className="media-card__snake">
          <div className="media-card__snake-ring" aria-hidden="true">
            <div className="media-card__snake-beam media-card__snake-beam--trail" />
            <div className="media-card__snake-beam media-card__snake-beam--core" />
          </div>
          <div
            className={`media-card__poster-wrap${isEmptyCard && !isLoading ? ' media-card__poster-wrap--empty' : ''}${isLoading ? ' media-card__poster-wrap--loading' : ''}`}
          >
            {isLoading || isEmptyCard ? (
              <MediaCoverPlaceholder
                className="media-card__cover-placeholder"
                fill
                variant="poster"
                animate={isLoading}
              />
            ) : null}
            {showImage ? (
              <img
                key={src}
                className="media-card__poster media-card__poster--ready"
                src={src}
                alt={item.title}
                loading={loading}
                decoding="async"
                draggable={false}
                referrerPolicy="no-referrer"
                onDragStart={(event) => event.preventDefault()}
                onError={onError}
              />
            ) : null}
            {(watched || inFavorites) ? (
              <div className="media-card__status-badges">
                {watched ? (
                  <span className="media-card__status-badge" aria-label="Просмотрено" title="Просмотрено">
                    <EyeOffIcon size={18} solid />
                  </span>
                ) : null}
                {inFavorites ? (
                  <span className="media-card__status-badge" aria-label="В избранном" title="В избранном">
                    <FavoritesIcon size={16} filled strokeWidth={2} />
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="media-card__dim" aria-hidden="true" />
            <div className="media-card__play">
              <PlayOverlayIcon size={54} />
            </div>
          </div>
        </div>

        {settings.cardShowInfo && (
          <div className="media-card__info">
            <h3 className="media-card__title">{item.title}</h3>
            {metaParts.length > 0 ? <p className="media-card__meta">{metaParts.join(' · ')}</p> : null}
          </div>
        )}
      </article>

      <ContextMenu
        open={contextMenu != null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        className="context-menu--media"
        header={<MediaContextMenuHeader item={item} posterUrl={showImage ? src : undefined} />}
        items={getMediaContextMenuItems(item, {
          isFavorite: inFavorites,
          isWatched: watched,
        })}
        onClose={closeContextMenu}
        onItemClick={handleContextMenuItem}
      />

      <MediaDescriptionDialog
        open={descriptionOpen}
        title={item.title}
        description={item.description}
        genres={item.genres}
        onClose={() => setDescriptionOpen(false)}
      />
    </>
  );
}
