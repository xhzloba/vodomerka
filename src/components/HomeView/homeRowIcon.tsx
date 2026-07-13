import type { ReactNode } from 'react';
import type { ContentRow } from '@/shared/domain/media';
import { isTrendingHomeRow } from '@/shared/domain/homeSections';
import { TrendingIcon, WatchingIcon } from '@/shared/ui/icons';

export function getHomeRowIcon(row: Pick<ContentRow, 'title' | 'playlistUrl' | 'id'>): ReactNode | null {
  if (isTrendingHomeRow(row)) {
    return <TrendingIcon size={22} />;
  }

  if (row.title === 'Сейчас смотрят' || row.playlistUrl.includes('sort=watching')) {
    return <WatchingIcon size={22} />;
  }

  return null;
}
