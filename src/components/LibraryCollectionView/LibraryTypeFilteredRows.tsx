import { useMemo, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { normalizeMediaType } from '../../../contracts/mediaType';
import { ContentRow } from '../ContentRow/ContentRow';
import {
  ContentRowTypeFilter,
  type MediaTypeFilter,
} from '../ContentRow/ContentRowTypeFilter';

function withCanonicalType(item: MediaItem): MediaItem {
  const type = normalizeMediaType(item.type);
  if (!type || type === item.type) {
    return item;
  }
  return { ...item, type };
}

interface LibraryTypeFilteredRowsProps {
  items: MediaItem[];
  onMediaSelect: (item: MediaItem) => void;
  /** Accessible name for the type filter. */
  filterAriaLabel?: string;
}

/** Single poster row + Все / Фильмы / Сериалы filter (same pattern as Home). */
export function LibraryTypeFilteredRows({
  items,
  onMediaSelect,
  filterAriaLabel = 'Фильтр по типу',
}: LibraryTypeFilteredRowsProps) {
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('all');

  const canonicalItems = useMemo(() => items.map(withCanonicalType), [items]);

  const filteredItems = useMemo(() => {
    if (typeFilter === 'movie') {
      return canonicalItems.filter(isMovieMedia);
    }
    if (typeFilter === 'serial') {
      return canonicalItems.filter(isSerialMedia);
    }
    return canonicalItems;
  }, [canonicalItems, typeFilter]);

  const title =
    typeFilter === 'movie' ? 'Фильмы' : typeFilter === 'serial' ? 'Сериалы' : 'Все';

  return (
    <ContentRow
      title={title}
      titleCount={filteredItems.length}
      items={filteredItems}
      onMediaSelect={onMediaSelect}
      headerExtra={
        <ContentRowTypeFilter
          value={typeFilter}
          onChange={setTypeFilter}
          ariaLabel={filterAriaLabel}
        />
      }
    />
  );
}
