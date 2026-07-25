/** Mutually exclusive personal watch statuses. Favorites stay orthogonal. */
import type { WatchStatus } from '../../../contracts/ipc';

export type { WatchStatus } from '../../../contracts/ipc';

export const WATCH_STATUSES: readonly WatchStatus[] = [
  'watching',
  'watched',
  'postponed',
  'dropped',
];

export function isWatchStatus(value: unknown): value is WatchStatus {
  return typeof value === 'string' && (WATCH_STATUSES as readonly string[]).includes(value);
}

export const WATCH_STATUS_LABELS: Record<WatchStatus, string> = {
  watching: 'Смотрю',
  watched: 'Просмотрено',
  postponed: 'Отложено',
  dropped: 'Брошено',
};

export const WATCH_STATUS_EMPTY_HINTS: Record<WatchStatus, string> = {
  watching: 'Отметьте то, что смотрите сейчас — появится здесь',
  watched: 'Отмечайте фильмы и сериалы как просмотренные — они появятся здесь',
  postponed: 'Отложите на потом — список будет здесь',
  dropped: 'Брошенные тайтлы появятся здесь',
};

export const WATCH_STATUS_CLEAR_COPY: Record<
  WatchStatus,
  { title: string; description: string; ariaLabel: string; loadingTitle: string }
> = {
  watching: {
    title: 'Очистить «Смотрю»?',
    description: 'Все записи со статусом «Смотрю» будут удалены без возможности восстановления.',
    ariaLabel: 'Очистить список «Смотрю»',
    loadingTitle: 'Загрузка списка «Смотрю»...',
  },
  watched: {
    title: 'Очистить просмотренное?',
    description: 'Все просмотренные фильмы и сериалы будут удалены без возможности восстановления.',
    ariaLabel: 'Очистить просмотренное',
    loadingTitle: 'Загрузка просмотренного...',
  },
  postponed: {
    title: 'Очистить отложенное?',
    description: 'Все отложенные записи будут удалены без возможности восстановления.',
    ariaLabel: 'Очистить отложенное',
    loadingTitle: 'Загрузка отложенного...',
  },
  dropped: {
    title: 'Очистить брошенное?',
    description: 'Все брошенные записи будут удалены без возможности восстановления.',
    ariaLabel: 'Очистить брошенное',
    loadingTitle: 'Загрузка брошенного...',
  },
};

export type WatchStatusNavItem = WatchStatus;

export const COLLECTION_TAB_IDS = ['favorites', ...WATCH_STATUSES] as const;

export function isWatchStatusNavItem(value: string): value is WatchStatusNavItem {
  return isWatchStatus(value);
}
