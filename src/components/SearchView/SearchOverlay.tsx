import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SearchTypeFilter } from '@/features/search/model/useMediaSearch';
import type { MediaItem } from '@/shared/domain/media';
import { useOverlayScroll } from '@/shared/hooks/useOverlayScroll';
import { FilmIcon, TvIcon } from '@/shared/ui/icons';
import { SearchPanel } from './SearchPanel';
import './SearchOverlay.css';

interface SearchOverlayProps {
  open: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onMediaSelect: (item: MediaItem) => void;
  onClose: () => void;
}

const SPOTLIGHT_ORBS: {
  id: Exclude<SearchTypeFilter, 'all'>;
  label: string;
  icon: ReactNode;
}[] = [
  { id: 'movie', label: 'Фильмы', icon: <FilmIcon size={22} strokeWidth={1.75} /> },
  { id: 'serial', label: 'Сериалы', icon: <TvIcon size={22} strokeWidth={1.75} /> },
];

function getPageScroller(): HTMLElement | null {
  return document.querySelector(
    '.app__view-layer:not(.app__view-layer--hidden) .scroll-overlay',
  );
}

function canScrollResults(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const body = target.closest('.search-spotlight__body');
  return body instanceof HTMLElement && body.scrollHeight > body.clientHeight + 1;
}

export function SearchOverlay({
  open,
  query,
  onQueryChange,
  onMediaSelect,
  onClose,
}: SearchOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const [typeFilter, setTypeFilter] = useState<SearchTypeFilter>('all');
  const [revealOrbs, setRevealOrbs] = useState(false);
  const trimmed = query.trim();
  const showResultsChrome = trimmed.length > 0;

  useEffect(() => {
    if (!open) {
      setTypeFilter('all');
      setRevealOrbs(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setRevealOrbs(true);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (canScrollResults(event.target)) {
        return;
      }

      const scroller = getPageScroller();
      if (!scroller) {
        return;
      }

      scroller.scrollTop += event.deltaY;
      event.preventDefault();
    };

    root.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      root.removeEventListener('wheel', handleWheel);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handleMediaSelect = (item: MediaItem) => {
    onClose();
    onMediaSelect(item);
  };

  const toggleFilter = (id: Exclude<SearchTypeFilter, 'all'>) => {
    setTypeFilter((current) => (current === id ? 'all' : id));
  };

  return createPortal(
    <div ref={rootRef} className="search-overlay" role="presentation">
      <button
        type="button"
        className="search-overlay__backdrop"
        aria-label="Закрыть поиск"
        onClick={onClose}
      />

      <div
        className={[
          'search-overlay__stage',
          revealOrbs ? 'search-overlay__stage--orbs' : '',
          showResultsChrome ? 'search-overlay__stage--typing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className="search-overlay__orbs"
          aria-hidden={!revealOrbs || showResultsChrome}
        >
          {SPOTLIGHT_ORBS.map((orb, index) => {
            const active = typeFilter === orb.id;
            const orbsInteractive = revealOrbs && !showResultsChrome;

            return (
              <button
                key={orb.id}
                type="button"
                className={`search-overlay__orb${active ? ' search-overlay__orb--active' : ''}`}
                style={{ '--orb-index': index } as CSSProperties}
                aria-pressed={active}
                aria-label={orb.label}
                tabIndex={orbsInteractive ? 0 : -1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleFilter(orb.id)}
              >
                <span className="search-overlay__orb-icon" aria-hidden="true">
                  {orb.icon}
                </span>
                <span className="search-overlay__orb-label">{orb.label}</span>
              </button>
            );
          })}
        </div>

        <div
          className="search-overlay__panel scroll-overlay"
          ref={scrollRef}
          role="dialog"
          aria-modal="true"
          aria-label="Быстрый поиск"
        >
          <SearchPanel
            query={query}
            onQueryChange={onQueryChange}
            onMediaSelect={handleMediaSelect}
            autoFocus
            variant="overlay"
            inputId="search-overlay-input"
            typeFilter={typeFilter}
            expanded={showResultsChrome}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
