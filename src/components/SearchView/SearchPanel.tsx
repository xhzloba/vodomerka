import { useMediaSearch } from '@/features/search/model/useMediaSearch';
import { getSearchShortcutParts } from '@/features/onboarding/tips/platformShortcut';
import type { MediaItem } from '@/shared/domain/media';
import { SearchIcon } from '@/shared/ui/icons';
import { ShortcutKeys } from '@/shared/ui/ShortcutKeys/ShortcutKeys';
import { MediaCard } from '../MediaCard/MediaCard';
import { PageLoading } from '@/shared/ui/PageState';

interface SearchPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  onMediaSelect: (item: MediaItem) => void;
  autoFocus?: boolean;
  variant?: 'page' | 'overlay';
  inputId?: string;
}

export function SearchPanel({
  query,
  onQueryChange,
  onMediaSelect,
  autoFocus = false,
  variant = 'page',
  inputId = 'search-panel-input',
}: SearchPanelProps) {
  const { isLoading, results } = useMediaSearch(query);
  const isOverlay = variant === 'overlay';
  const searchShortcutParts = getSearchShortcutParts();

  return (
    <>
      {isOverlay ? (
        <header className="search-view__overlay-header">
          <div className="search-view__overlay-heading">
            <span className="search-view__overlay-icon" aria-hidden="true">
              <SearchIcon size={18} />
            </span>
            <span className="search-view__overlay-title">Быстрый поиск</span>
          </div>
          <ShortcutKeys keys={searchShortcutParts} size="md" muted />
        </header>
      ) : (
        <h1 className="search-view__title">Поиск</h1>
      )}

      <div
        className={`search-view__input-wrap${isOverlay ? ' search-view__input-wrap--overlay' : ''}`}
      >
        {!isOverlay ? <SearchIcon className="search-view__icon" size={22} /> : null}
        <input
          id={inputId}
          className={`search-view__input${isOverlay ? ' search-view__input--overlay' : ''}`}
          type="search"
          placeholder={isOverlay ? 'Название, жанр, год...' : 'Фильмы, сериалы, жанры...'}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {isOverlay ? (
        <footer className="search-view__overlay-footer">
          <div className="search-view__overlay-hint">
            <ShortcutKeys keys={['Esc']} size="sm" muted />
            <span>закрыть</span>
          </div>
          <div className="search-view__overlay-hint">
            <ShortcutKeys keys={searchShortcutParts} size="sm" muted />
            <span>переключить</span>
          </div>
        </footer>
      ) : null}

      {isLoading ? (
        <div
          className={`search-view__loading${isOverlay ? ' search-view__loading--overlay' : ''}`}
          aria-busy="true"
          aria-label="Подготовка поиска"
        >
          <PageLoading title="Подготовка поиска..." centered={isOverlay} />
        </div>
      ) : null}

      {!isLoading && !query.trim() ? (
        <div className={`search-view__empty${isOverlay ? ' search-view__empty--overlay' : ''}`}>
          <p>{isOverlay ? 'Начни вводить — результаты появятся здесь' : 'Найди фильм или сериал по названию или жанру'}</p>
        </div>
      ) : null}

      {!isLoading && query.trim() && results.length === 0 ? (
        <div className={`search-view__empty${isOverlay ? ' search-view__empty--overlay' : ''}`}>
          <p>Ничего не найдено по запросу «{query}»</p>
        </div>
      ) : null}

      {!isLoading && results.length > 0 ? (
        <>
          <h2 className="search-view__results-title">Результаты ({results.length})</h2>
          <div className={`search-view__grid${isOverlay ? ' search-view__grid--overlay' : ''}`}>
            {results.map((item) => (
              <MediaCard key={item.id} item={item} onSelect={onMediaSelect} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
