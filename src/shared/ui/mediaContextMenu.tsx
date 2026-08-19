import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import {
  WATCH_STATUS_LABELS,
  WATCH_STATUSES,
  type WatchStatus,
} from '@/shared/domain/watchStatus';
import type { ContextMenuItem } from '@/shared/ui/ContextMenu/ContextMenu';
import {
  BanIcon,
  BookOpenIcon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FavoritesIcon,
  InfoIcon,
  PauseCircleIcon,
  WatchingIcon,
} from '@/shared/ui/icons';
import './MediaContextMenu.css';

interface MediaContextMenuState {
  isFavorite: boolean;
  watchStatus: WatchStatus | null;
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

function statusIcon(status: WatchStatus, active: boolean) {
  const stroke = active ? 2.1 : 1.75;
  switch (status) {
    case 'watching':
      return <WatchingIcon size={15} strokeWidth={stroke} />;
    case 'watched':
      return <EyeIcon size={15} strokeWidth={stroke} />;
    case 'postponed':
      return <PauseCircleIcon size={15} strokeWidth={stroke} />;
    case 'dropped':
      return <BanIcon size={15} strokeWidth={stroke} />;
  }
}

export function getMediaContextMenuItems(
  item: MediaItem,
  { isFavorite, watchStatus }: MediaContextMenuState,
): ContextMenuItem[] {
  const statusLabel = watchStatus ? WATCH_STATUS_LABELS[watchStatus] : 'Не выбран';

  return [
    {
      id: 'details',
      label: 'Подробнее',
      icon: <InfoIcon size={15} />,
    },
    {
      id: 'description',
      label: 'Описание',
      icon: <BookOpenIcon size={15} />,
      disabled: !item.description && item.genres.length === 0,
    },
    {
      id: 'download',
      label: 'Скачать',
      icon: <DownloadIcon size={15} />,
      separatorBefore: true,
    },
    {
      id: 'copy-id',
      label: 'Скопировать ID',
      icon: <CopyIcon size={15} />,
    },
    {
      id: 'favorite',
      label: 'Избранное',
      icon: <FavoritesIcon size={15} filled={isFavorite} strokeWidth={isFavorite ? 2 : 1.75} />,
      active: isFavorite,
      separatorBefore: true,
    },
    {
      id: 'status-group',
      label: `Статус: ${statusLabel}`,
      icon: watchStatus ? statusIcon(watchStatus, true) : <WatchingIcon size={15} strokeWidth={1.75} />,
      separatorBefore: true,
      children: [
        {
          id: 'status:none',
          label: 'Не выбран',
          icon: <EyeOffIcon size={15} strokeWidth={watchStatus === null ? 2.1 : 1.75} />,
          active: watchStatus === null,
        },
        ...WATCH_STATUSES.map((status) => ({
          id: `status:${status}`,
          label: WATCH_STATUS_LABELS[status],
          icon: statusIcon(status, watchStatus === status),
          active: watchStatus === status,
        })),
      ],
    },
  ];
}
