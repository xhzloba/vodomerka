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
  onExited?: () => void;
}

const SPOTLIGHT_ORBS: {
  id: Exclude<SearchTypeFilter, 'all'>;
  label: string;
  icon: ReactNode;
}[] = [
  { id: 'movie', label: 'Фильмы', icon: <FilmIcon size={22} strokeWidth={1.75} /> },
  { id: 'serial', label: 'Сериалы', icon: <TvIcon size={22} strokeWidth={1.75} /> },
];

const EXIT_MS = 200;

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
  onExited,
}: SearchOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const queryRef = useRef(query);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<SearchTypeFilter>('all');
  const [revealOrbs, setRevealOrbs] = useState(false);
  const [exitQuery, setExitQuery] = useState(query);
  const trimmed = (closing ? exitQuery : query).trim();
  const isTyping = trimmed.length > 0;
  const showResultsChrome = isTyping || typeFilter !== 'all';
  const visible = mounted;

  queryRef.current = query;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }

    if (!mounted) {
      return;
    }

    setExitQuery(queryRef.current);
    setClosing(true);

    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
      setTypeFilter('all');
      setRevealOrbs(false);
      onExited?.();
    }, EXIT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, mounted, onExited]);

  useEffect(() => {
    if (!open || closing) {
      return;
    }

    setRevealOrbs(false);

    const timer = window.setTimeout(() => {
      setRevealOrbs(true);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, closing]);

  useEffect(() => {
    if (!open || closing) {
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
  }, [open, closing, onClose]);

  useEffect(() => {
    if (!open || closing || !mounted) {
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

      let delta = event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        delta *= 16;
      } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        delta *= scroller.clientHeight;
      }

      scroller.scrollTop += delta;
      event.preventDefault();
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [open, closing, mounted]);

  if (!visible) {
    return null;
  }

  const displayQuery = closing ? exitQuery : query;

  const handleMediaSelect = (item: MediaItem) => {
    onClose();
    onMediaSelect(item);
  };

  const toggleFilter = (id: Exclude<SearchTypeFilter, 'all'>) => {
    setTypeFilter((current) => (current === id ? 'all' : id));
  };

  return createPortal(
    <div
      ref={rootRef}
      className={`search-overlay${closing ? ' search-overlay--closing' : ''}`}
      role="presentation"
    >
      <button
        type="button"
        className="search-overlay__backdrop"
        aria-label="Закрыть поиск"
        onClick={onClose}
        disabled={closing}
      />

      <div
        className={[
          'search-overlay__stage',
          revealOrbs ? 'search-overlay__stage--orbs' : '',
          showResultsChrome && isTyping ? 'search-overlay__stage--typing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className="search-overlay__orbs"
          aria-hidden={!revealOrbs || isTyping || closing}
        >
          {SPOTLIGHT_ORBS.map((orb, index) => {
            const active = typeFilter === orb.id;
            const orbsInteractive = revealOrbs && !isTyping && !closing;

            return (
              <button
                key={orb.id}
                type="button"
                className={`search-overlay__orb${active ? ' search-overlay__orb--active' : ''}`}
                style={{ '--orb-index': index } as CSSProperties}
                aria-pressed={active}
                aria-label={orb.label}
                tabIndex={orbsInteractive ? 0 : -1}
                disabled={closing}
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
            query={displayQuery}
            onQueryChange={onQueryChange}
            onMediaSelect={handleMediaSelect}
            autoFocus={!closing}
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
