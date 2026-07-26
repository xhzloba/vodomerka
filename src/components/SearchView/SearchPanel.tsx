import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { getSearchShortcutParts } from '@/features/onboarding/tips/platformShortcut';
import {
  useMediaSearch,
  type SearchTypeFilter,
} from '@/features/search/model/useMediaSearch';
import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { HeroRating } from '@/shared/ui/HeroRating/HeroRating';
import { SearchIcon } from '@/shared/ui/icons';
import { PageLoading } from '@/shared/ui/PageState';
import { ShortcutKeys } from '@/shared/ui/ShortcutKeys/ShortcutKeys';
import { MediaCard } from '../MediaCard/MediaCard';
import './SearchView.css';

const DRAWER_MS = 320;

interface SearchPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  onMediaSelect: (item: MediaItem) => void;
  autoFocus?: boolean;
  variant?: 'page' | 'overlay';
  inputId?: string;
  typeFilter?: SearchTypeFilter;
  expanded?: boolean;
  onFieldPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

interface SpotlightDrawerSnapshot {
  results: MediaItem[];
  sectionLabel: string | null;
  empty: boolean;
  loading: boolean;
}

function SpotlightResultRow({
  item,
  onSelect,
}: {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}) {
  const typeLabel = getMediaTypeLabel(item.type);

  return (
    <button type="button" className="search-spotlight__row" onClick={() => onSelect(item)}>
      <span className="search-spotlight__icon-tile">
        {item.poster ? (
          <img
            className="search-spotlight__icon-img"
            src={item.poster}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        ) : (
          <span className="search-spotlight__icon-fallback" aria-hidden="true" />
        )}
      </span>
      <span className="search-spotlight__copy">
        <span className="search-spotlight__title">{item.title}</span>
        <span className="search-spotlight__subtitle">
          {[typeLabel, item.year != null ? String(item.year) : null].filter(Boolean).join(' · ')}
        </span>
      </span>
      {item.rating != null ? (
        <span className="search-spotlight__chip">
          <HeroRating rating={item.rating} />
        </span>
      ) : null}
    </button>
  );
}

function groupSearchResults(results: MediaItem[]): { label: string; items: MediaItem[] }[] {
  const groups = new Map<string, MediaItem[]>();

  for (const item of results) {
    const label = getMediaTypeLabel(item.type) || 'Другое';
    const bucket = groups.get(label);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(label, [item]);
    }
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

function SpotlightDrawerBody({
  results,
  sectionLabel,
  empty,
  loading,
  onMediaSelect,
}: {
  results: MediaItem[];
  sectionLabel: string | null;
  empty: boolean;
  loading: boolean;
  onMediaSelect: (item: MediaItem) => void;
}) {
  if (loading) {
    return (
      <div className="search-spotlight__body" aria-busy="true" aria-label="Поиск">
        <PageLoading title="Ищем…" centered />
      </div>
    );
  }

  if (empty) {
    return (
      <div className="search-spotlight__body search-spotlight__body--empty">
        <p>Ничего не найдено</p>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="search-spotlight__body">
      {sectionLabel ? (
        <section className="search-spotlight__group">
          <h2 className="search-spotlight__section">{sectionLabel}</h2>
          <div className="search-spotlight__list" role="listbox" aria-label={sectionLabel}>
            {results.map((item) => (
              <SpotlightResultRow key={item.id} item={item} onSelect={onMediaSelect} />
            ))}
          </div>
        </section>
      ) : (
        groupSearchResults(results).map((group) => (
          <section key={group.label} className="search-spotlight__group">
            <h2 className="search-spotlight__section">{group.label}</h2>
            <div className="search-spotlight__list" role="listbox" aria-label={group.label}>
              {group.items.map((item) => (
                <SpotlightResultRow key={item.id} item={item} onSelect={onMediaSelect} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export function SearchPanel({
  query,
  onQueryChange,
  onMediaSelect,
  autoFocus = false,
  variant = 'page',
  inputId = 'search-panel-input',
  typeFilter = 'all',
  expanded = false,
  onFieldPointerDown,
}: SearchPanelProps) {
  const { isLoading, results } = useMediaSearch(query, typeFilter);
  const isOverlay = variant === 'overlay';
  const searchShortcutParts = getSearchShortcutParts();
  const trimmed = query.trim();
  const showIdleTrending = !trimmed && typeFilter !== 'all';
  const showEmpty = !isLoading && trimmed.length > 0 && results.length === 0;
  const showLoading = isLoading && (trimmed.length > 0 || showIdleTrending);
  const overlayPlaceholder =
    typeFilter === 'movie'
      ? 'Поиск по фильмам'
      : typeFilter === 'serial'
        ? 'Поиск по сериалам'
        : 'Поиск';
  const resultsSectionLabel =
    showIdleTrending
      ? typeFilter === 'movie'
        ? 'В тренде · Фильмы'
        : 'В тренде · Сериалы'
      : null;

  const [uiExpanded, setUiExpanded] = useState(expanded);
  const [held, setHeld] = useState<SpotlightDrawerSnapshot>({
    results: [],
    sectionLabel: null,
    empty: false,
    loading: false,
  });
  const liveSnapshotRef = useRef<SpotlightDrawerSnapshot>(held);

  if (expanded) {
    liveSnapshotRef.current = {
      results,
      sectionLabel: resultsSectionLabel,
      empty: showEmpty,
      loading: showLoading,
    };
  }

  useLayoutEffect(() => {
    if (expanded) {
      setUiExpanded(true);
      setHeld(liveSnapshotRef.current);
      return;
    }

    setUiExpanded(false);

    const timer = window.setTimeout(() => {
      setHeld({
        results: [],
        sectionLabel: null,
        empty: false,
        loading: false,
      });
    }, DRAWER_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    setHeld(liveSnapshotRef.current);
  }, [expanded, results, resultsSectionLabel, showEmpty, showLoading]);

  if (isOverlay) {
    const drawerSnapshot = expanded ? liveSnapshotRef.current : held;
    const hasDrawerContent =
      drawerSnapshot.loading || drawerSnapshot.empty || drawerSnapshot.results.length > 0;

    return (
      <div
        className={`search-spotlight${uiExpanded ? ' search-spotlight--expanded' : ' search-spotlight--idle'}`}
      >
        <div className="search-spotlight__field" onPointerDown={onFieldPointerDown}>
          <span className="search-spotlight__icon" aria-hidden="true">
            <SearchIcon size={20} />
          </span>
          <input
            id={inputId}
            className="search-spotlight__input"
            type="search"
            placeholder={overlayPlaceholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
          />
          <span
            className={`search-spotlight__shortcut${uiExpanded ? ' search-spotlight__shortcut--hidden' : ''}`}
            aria-hidden={uiExpanded}
          >
            <ShortcutKeys keys={searchShortcutParts} size="sm" muted />
          </span>
        </div>

        <div className="search-spotlight__drawer" aria-hidden={!uiExpanded}>
          <div className="search-spotlight__drawer-inner">
            {hasDrawerContent ? (
              <SpotlightDrawerBody
                results={drawerSnapshot.results}
                sectionLabel={drawerSnapshot.sectionLabel}
                empty={drawerSnapshot.empty}
                loading={drawerSnapshot.loading}
                onMediaSelect={onMediaSelect}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="search-view__title">Поиск</h1>

      <div className="search-view__input-wrap">
        <SearchIcon className="search-view__icon" size={22} />
        <input
          id={inputId}
          className="search-view__input"
          type="search"
          placeholder="Фильмы, сериалы, жанры..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {isLoading ? (
        <div className="search-view__loading" aria-busy="true" aria-label="Подготовка поиска">
          <PageLoading title="Подготовка поиска..." />
        </div>
      ) : null}

      {!isLoading && !trimmed ? (
        <div className="search-view__empty">
          <p>Найди фильм или сериал по названию или жанру</p>
        </div>
      ) : null}

      {!isLoading && trimmed && results.length === 0 ? (
        <div className="search-view__empty">
          <p>Ничего не найдено по запросу «{query}»</p>
        </div>
      ) : null}

      {!isLoading && results.length > 0 ? (
        <>
          <h2 className="search-view__results-title">Результаты ({results.length})</h2>
          <div className="search-view__grid">
            {results.map((item) => (
              <MediaCard key={item.id} item={item} onSelect={onMediaSelect} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
