import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
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
const DRAG_THRESHOLD_PX = 8;
const VIEWPORT_PAD = 12;

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

function clampStagePosition(left: number, top: number, width: number, height: number) {
  const maxLeft = Math.max(VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD);
  const maxTop = Math.max(VIEWPORT_PAD, window.innerHeight - height - VIEWPORT_PAD);

  return {
    left: Math.min(Math.max(VIEWPORT_PAD, left), maxLeft),
    top: Math.min(Math.max(VIEWPORT_PAD, top), maxTop),
  };
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
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useOverlayScroll<HTMLDivElement>();
  const queryRef = useRef(query);
  const suppressBackdropClickRef = useRef(false);
  const dragRef = useRef({
    active: false,
    dragging: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0,
  });

  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<SearchTypeFilter>('all');
  const [revealOrbs, setRevealOrbs] = useState(false);
  const [exitQuery, setExitQuery] = useState(query);
  const [stagePosition, setStagePosition] = useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const trimmed = (closing ? exitQuery : query).trim();
  const isTyping = trimmed.length > 0;
  const showResultsChrome = isTyping || typeFilter !== 'all';
  const visible = mounted;

  queryRef.current = query;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setStagePosition(null);
      setIsDragging(false);
      return;
    }

    if (!mounted) {
      return;
    }

    setExitQuery(queryRef.current);
    setClosing(true);
    setIsDragging(false);

    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
      setTypeFilter('all');
      setRevealOrbs(false);
      setStagePosition(null);
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

  useEffect(() => {
    if (!open || closing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || event.pointerId !== drag.pointerId) {
        return;
      }

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (!drag.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
          return;
        }

        drag.dragging = true;
        setIsDragging(true);
        suppressBackdropClickRef.current = true;

        const active = document.activeElement;
        if (active instanceof HTMLElement) {
          active.blur();
        }
        window.getSelection()?.removeAllRanges();
      }

      event.preventDefault();

      const stage = stageRef.current;
      const width = stage?.offsetWidth ?? 560;
      const height = stage?.offsetHeight ?? 58;
      setStagePosition(
        clampStagePosition(drag.originLeft + dx, drag.originTop + dy, width, height),
      );
    };

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || event.pointerId !== drag.pointerId) {
        return;
      }

      const wasDragging = drag.dragging;
      drag.active = false;
      drag.dragging = false;
      setIsDragging(false);

      if (wasDragging) {
        window.setTimeout(() => {
          suppressBackdropClickRef.current = false;
        }, 0);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [open, closing]);

  const handleFieldPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (closing || event.button !== 0) {
        return;
      }

      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      const rect = stage.getBoundingClientRect();
      dragRef.current = {
        active: true,
        dragging: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
      };
    },
    [closing],
  );

  const handleBackdropClick = () => {
    if (suppressBackdropClickRef.current || isDragging) {
      return;
    }
    onClose();
  };

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

  const stageStyle =
    stagePosition != null
      ? ({
          left: `${stagePosition.left}px`,
          top: `${stagePosition.top}px`,
        } as CSSProperties)
      : undefined;

  return createPortal(
    <div
      ref={rootRef}
      className={`search-overlay${closing ? ' search-overlay--closing' : ''}${
        isDragging ? ' search-overlay--dragging' : ''
      }`}
      role="presentation"
    >
      <button
        type="button"
        className="search-overlay__backdrop"
        aria-label="Закрыть поиск"
        onClick={handleBackdropClick}
        disabled={closing}
      />

      <div
        ref={stageRef}
        className={[
          'search-overlay__stage',
          revealOrbs ? 'search-overlay__stage--orbs' : '',
          showResultsChrome && isTyping ? 'search-overlay__stage--typing' : '',
          stagePosition != null ? 'search-overlay__stage--moved' : '',
          isDragging ? 'search-overlay__stage--dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={stageStyle}
      >
        <div
          className="search-overlay__orbs"
          aria-hidden={!revealOrbs || isTyping || closing}
        >
          {SPOTLIGHT_ORBS.map((orb, index) => {
            const active = typeFilter === orb.id;
            const orbsInteractive = revealOrbs && !isTyping && !closing && !isDragging;

            return (
              <button
                key={orb.id}
                type="button"
                className={`search-overlay__orb${active ? ' search-overlay__orb--active' : ''}`}
                style={{ '--orb-index': index } as CSSProperties}
                aria-pressed={active}
                aria-label={orb.label}
                tabIndex={orbsInteractive ? 0 : -1}
                disabled={closing || isDragging}
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
            autoFocus={!closing && !isDragging}
            variant="overlay"
            inputId="search-overlay-input"
            typeFilter={typeFilter}
            expanded={showResultsChrome}
            onFieldPointerDown={handleFieldPointerDown}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
