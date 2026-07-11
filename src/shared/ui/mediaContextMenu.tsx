import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import type { ContextMenuItem } from '@/shared/ui/ContextMenu/ContextMenu';
import {
  BookOpenIcon,
  EyeIcon,
  FavoritesIcon,
  InfoIcon,
} from '@/shared/ui/icons';
import './MediaContextMenu.css';

interface MediaContextMenuState {
  isFavorite: boolean;
  isWatched: boolean;
}

interface MediaContextMenuHeaderProps {
  item: MediaItem;
  posterUrl?: string;
}

export function MediaContextMenuHeader({ item, posterUrl }: MediaContextMenuHeaderProps) {
  const metaParts = [
    getMediaTypeLabel(item.type),
    item.year != null ? String(item.year) : null,
    item.rating != null ? `★ ${item.rating.toFixed(1)}` : null,
  ].filter(Boolean);

  return (
    <div className="media-context-menu__header">
      <div className="media-context-menu__poster" aria-hidden="true">
        {posterUrl ? (
          <img src={posterUrl} alt="" loading="eager" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <span className="media-context-menu__poster-fallback">{item.title.slice(0, 1)}</span>
        )}
      </div>
      <div className="media-context-menu__info">
        <p className="media-context-menu__title">{item.title}</p>
        {metaParts.length > 0 ? <p className="media-context-menu__meta">{metaParts.join(' · ')}</p> : null}
      </div>
    </div>
  );
}

export function getMediaContextMenuItems(
  item: MediaItem,
  { isFavorite, isWatched }: MediaContextMenuState,
): ContextMenuItem[] {
  return [
    {
      id: 'details',
      label: 'Подробнее',
      icon: <InfoIcon size={16} />,
    },
    {
      id: 'description',
      label: 'Описание',
      icon: <BookOpenIcon size={16} />,
      disabled: !item.description && item.genres.length === 0,
    },
    {
      id: 'favorite',
      label: isFavorite ? 'Убрать из избранного' : 'Добавить в избранное',
      icon: <FavoritesIcon size={16} filled={isFavorite} />,
      active: isFavorite,
      separatorBefore: true,
    },
    {
      id: 'watched',
      label: isWatched ? 'Убрать из просмотренного' : 'Отметить просмотренным',
      icon: <EyeIcon size={16} strokeWidth={isWatched ? 2.1 : 1.75} />,
      active: isWatched,
      tone: isWatched ? 'danger' : 'default',
    },
  ];
}
