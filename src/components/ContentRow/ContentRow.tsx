import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { useHorizontalDragScroll } from '@/shared/hooks/useHorizontalDragScroll';
import { ChevronLeftIcon, ChevronRightIcon, EyeOffIcon } from '@/shared/ui/icons';
import { MediaCard } from '../MediaCard/MediaCard';
import './ContentRow.css';

interface ContentRowProps {
  title: string;
  items: MediaItem[];
  variant?: 'poster' | 'wide';
  hideTitle?: boolean;
  icon?: ReactNode;
  titleCount?: number;
  onHide?: () => void;
  onMediaSelect: (item: MediaItem) => void;
  edgeFade?: boolean;
}

function canScrollHorizontally(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth + 1;
}

export function ContentRow({
  title,
  items,
  variant = 'poster',
  hideTitle = false,
  icon,
  titleCount,
  onHide,
  onMediaSelect,
  edgeFade = false,
}: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [edgeFadeStrength, setEdgeFadeStrength] = useState(0);
  const itemsOrderKey = items.map((item) => item.id).join('\0');

  useHorizontalDragScroll(scrollRef, canScroll);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ left: 0, behavior: 'instant' });
  }, [itemsOrderKey]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    let frameId = 0;

    const update = () => {
      setCanScroll(canScrollHorizontally(element));
    };

    const scheduleUpdate = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = 0;
        update();
      });
    };

    update();

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(element);

    const parent = element.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    window.addEventListener('resize', scheduleUpdate);

    const rafId = requestAnimationFrame(update);
    const timeoutId = window.setTimeout(update, 320);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [items]);

  useEffect(() => {
    if (!edgeFade) {
      setEdgeFadeStrength(0);
      return;
    }

    const element = scrollRef.current;
    if (!element || !canScroll) {
      setEdgeFadeStrength(0);
      return;
    }

    const sync = () => {
      const progress = Math.min(1, element.scrollLeft / 80);
      setEdgeFadeStrength(1 - (1 - progress) ** 2);
    };

    sync();
    element.addEventListener('scroll', sync, { passive: true });

    return () => {
      element.removeEventListener('scroll', sync);
    };
  }, [canScroll, edgeFade, itemsOrderKey]);

  const scrollEdgeStyle = useMemo((): CSSProperties | undefined => {
    if (!edgeFade || edgeFadeStrength < 0.03) {
      return undefined;
    }

    const fadeEnd = 28 + edgeFadeStrength * 52;
    const softMid = fadeEnd * 0.42;
    const gradient = `linear-gradient(90deg, transparent 0px, rgba(0, 0, 0, ${(edgeFadeStrength * 0.55).toFixed(3)}) ${softMid.toFixed(1)}px, #000 ${fadeEnd.toFixed(1)}px, #000 100%)`;

    return {
      WebkitMaskImage: gradient,
      maskImage: gradient,
    };
  }, [edgeFade, edgeFadeStrength]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -400 : 400, behavior: 'smooth' });
  };

  const showHeader = !hideTitle || canScroll;

  return (
    <section
      className={`content-row${hideTitle ? ' content-row--no-title' : ''}${
        canScroll ? ' content-row--scrollable' : ''
      }${edgeFade ? ' content-row--edge-fade' : ''}`}
    >
      {showHeader ? (
        <div className="content-row__header">
          {!hideTitle && (
            <h2 className="content-row__title">
              {icon ? <span className="content-row__title-icon">{icon}</span> : null}
              <span>{title}</span>
              {titleCount != null ? (
                <span className="content-row__title-count">{titleCount}</span>
              ) : null}
              {onHide ? (
                <button
                  type="button"
                  className="content-row__hide-btn"
                  onClick={onHide}
                  aria-label={`Скрыть секцию «${title}»`}
                >
                  <EyeOffIcon size={14} strokeWidth={1.5} />
                  <span className="content-row__hide-btn-label">Скрыть секцию</span>
                </button>
              ) : null}
            </h2>
          )}
          {canScroll ? (
            <div className="content-row__nav" role="group" aria-label="Прокрутка ряда">
              <button
                type="button"
                className="content-row__nav-btn content-row__nav-btn--prev"
                onClick={() => scroll('left')}
                aria-label="Назад"
              >
                <ChevronLeftIcon size={16} strokeWidth={1.5} />
              </button>
              <span className="content-row__nav-divider" aria-hidden="true" />
              <button
                type="button"
                className="content-row__nav-btn content-row__nav-btn--next"
                onClick={() => scroll('right')}
                aria-label="Вперёд"
              >
                <ChevronRightIcon size={16} strokeWidth={1.5} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {edgeFade ? (
        <div className="content-row__scroll-shell">
          <div
            className="content-row__scroll scroll-overlay-x"
            ref={scrollRef}
            style={scrollEdgeStyle}
          >
            {items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                variant={variant}
                onSelect={onMediaSelect}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="content-row__scroll scroll-overlay-x" ref={scrollRef}>
          {items.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              variant={variant}
              onSelect={onMediaSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
