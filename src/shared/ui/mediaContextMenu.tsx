import type { MediaItem } from '@/shared/domain/media';
import {
  BookOpenIcon,
  EyeIcon,
  FavoritesIcon,
  InfoIcon,
} from '@/shared/ui/icons';
import type { ContextMenuItem } from '@/shared/ui/ContextMenu/ContextMenu';

interface MediaContextMenuState {
  isFavorite: boolean;
  isWatched: boolean;
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
      label: 'Избранное',
      icon: <FavoritesIcon size={16} filled={isFavorite} />,
    },
    {
      id: 'watched',
      label: isWatched ? 'Убрать из просмотренного' : 'Просмотрено',
      icon: <EyeIcon size={16} strokeWidth={isWatched ? 2.1 : 1.75} />,
    },
  ];
}
