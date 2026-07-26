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

interface SearchPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  onMediaSelect: (item: MediaItem) => void;
  autoFocus?: boolean;
  variant?: 'page' | 'overlay';
  inputId?: string;
  typeFilter?: SearchTypeFilter;
  expanded?: boolean;
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

export function SearchPanel({
  query,
  onQueryChange,
  onMediaSelect,
  autoFocus = false,
  variant = 'page',
  inputId = 'search-panel-input',
  typeFilter = 'all',
  expanded = false,
}: SearchPanelProps) {
  const { isLoading, results } = useMediaSearch(query, typeFilter);
  const isOverlay = variant === 'overlay';
  const searchShortcutParts = getSearchShortcutParts();
  const trimmed = query.trim();
  const showIdleTrending = !trimmed && typeFilter !== 'all';
  const showResults = !isLoading && results.length > 0;
  const showEmpty = !isLoading && trimmed.length > 0 && results.length === 0;
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

  if (isOverlay) {
    return (
      <div
        className={`search-spotlight${expanded ? ' search-spotlight--expanded' : ' search-spotlight--idle'}`}
      >
        <div className="search-spotlight__field">
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
            className={`search-spotlight__shortcut${expanded ? ' search-spotlight__shortcut--hidden' : ''}`}
            aria-hidden={expanded}
          >
            <ShortcutKeys keys={searchShortcutParts} size="sm" muted />
          </span>
        </div>

        <div className="search-spotlight__drawer" aria-hidden={!expanded}>
          <div className="search-spotlight__drawer-inner">
            {isLoading && (trimmed || showIdleTrending) ? (
              <div className="search-spotlight__body" aria-busy="true" aria-label="Поиск">
                <PageLoading title="Ищем…" centered />
              </div>
            ) : null}

            {showEmpty ? (
              <div className="search-spotlight__body search-spotlight__body--empty">
                <p>Ничего не найдено</p>
              </div>
            ) : null}

            {showResults ? (
              <div className="search-spotlight__body">
                {resultsSectionLabel ? (
                  <section className="search-spotlight__group">
                    <h2 className="search-spotlight__section">{resultsSectionLabel}</h2>
                    <div
                      className="search-spotlight__list"
                      role="listbox"
                      aria-label={resultsSectionLabel}
                    >
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
