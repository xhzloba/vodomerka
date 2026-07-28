import { useMemo, useState, type CSSProperties } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { isMovieMedia, isSerialMedia } from '@/shared/domain/media';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import {
  CATALOG_GAP_VALUES,
  type CollectionLayout,
} from '@/shared/settings/types';
import { GridIcon, RowsIcon } from '@/shared/ui/icons';
import { normalizeMediaType } from '../../../contracts/mediaType';
import { ContentRow } from '../ContentRow/ContentRow';
import {
  ContentRowTypeFilter,
  type MediaTypeFilter,
} from '../ContentRow/ContentRowTypeFilter';
import { MediaCard } from '../MediaCard/MediaCard';
import '../BrowseView/MediaGrid.css';
import './LibraryTypeFilteredRows.css';

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

/** Single poster row or catalog grid + Все / Фильмы / Сериалы filter. */
export function LibraryTypeFilteredRows({
  items,
  onMediaSelect,
  filterAriaLabel = 'Фильтр по типу',
}: LibraryTypeFilteredRowsProps) {
  const { settings, updateSettings } = useAppSettings();
  const [typeFilter, setTypeFilter] = useState<MediaTypeFilter>('all');
  const layout = settings.collectionLayout;

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

  const setLayout = (next: CollectionLayout) => {
    if (next === layout) {
      return;
    }
    void updateSettings({ collectionLayout: next });
  };

  const layoutToggle = (
    <div className="library-layout-toggle" role="radiogroup" aria-label="Вид раздела Моё">
      <button
        type="button"
        role="radio"
        aria-checked={layout === 'slider'}
        aria-label="Слайдер"
        title="Слайдер"
        className={`library-layout-toggle__btn${
          layout === 'slider' ? ' library-layout-toggle__btn--active' : ''
        }`}
        onClick={() => setLayout('slider')}
      >
        <RowsIcon size={15} strokeWidth={1.9} />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={layout === 'grid'}
        aria-label="Сетка"
        title="Сетка"
        className={`library-layout-toggle__btn${
          layout === 'grid' ? ' library-layout-toggle__btn--active' : ''
        }`}
        onClick={() => setLayout('grid')}
      >
        <GridIcon size={15} strokeWidth={1.9} />
      </button>
    </div>
  );

  const typeFilterControl = (
    <ContentRowTypeFilter
      value={typeFilter}
      onChange={setTypeFilter}
      ariaLabel={filterAriaLabel}
    />
  );

  if (layout === 'grid') {
    const gap = CATALOG_GAP_VALUES[settings.catalogRowGap];
    const gridStyle = {
      '--catalog-row-gap': `${gap.row}px`,
      '--catalog-column-gap': `${gap.column}px`,
    } as CSSProperties;

    return (
      <section className="library-type-grid">
        <div className="library-type-grid__header">
          <h2 className="library-type-grid__title">
            <span>{title}</span>
            <span className="library-type-grid__count">{filteredItems.length}</span>
          </h2>
          <div className="library-type-grid__aside">
            {typeFilterControl}
            {layoutToggle}
          </div>
        </div>
        <div className="media-grid library-type-grid__media" style={gridStyle}>
          {filteredItems.map((item) => (
            <MediaCard key={item.id} item={item} onSelect={onMediaSelect} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <ContentRow
      title={title}
      titleCount={filteredItems.length}
      items={filteredItems}
      onMediaSelect={onMediaSelect}
      headerExtra={
        <div className="library-type-grid__aside">
          {typeFilterControl}
          {layoutToggle}
        </div>
      }
    />
  );
}
