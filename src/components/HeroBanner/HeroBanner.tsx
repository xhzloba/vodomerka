import { Fragment, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import {
  MediaCoverPlaceholder,
  MediaPosterGlyph,
} from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';
import { HeroRating } from '@/shared/ui/HeroRating/HeroRating';
import { ClockIcon, InfoIcon, PlayIcon } from '@/shared/ui/icons';
import './HeroBanner.css';

interface HeroBannerProps {
  items: MediaItem[];
  autoSlide: boolean;
  slideIntervalSec: number;
  onPlay: (item: MediaItem) => void;
  onInfo: (item: MediaItem) => void;
}

type HeroMetaPart =
  | { kind: 'type'; value: string }
  | { kind: 'text'; value: string }
  | { kind: 'duration'; value: string }
  | { kind: 'age'; value: number }
  | { kind: 'rating'; value: number };

function buildMetaParts(item: MediaItem): HeroMetaPart[] {
  return [
    { kind: 'type', value: getMediaTypeLabel(item.type) },
    item.year != null ? { kind: 'text', value: String(item.year) } : null,
    item.duration ? { kind: 'duration', value: item.duration } : null,
    item.age != null ? { kind: 'age', value: item.age } : null,
    item.rating != null ? { kind: 'rating', value: item.rating } : null,
    item.genres[0] ? { kind: 'text', value: item.genres[0] } : null,
  ].filter((part): part is HeroMetaPart => part != null && part.value !== '');
}

function shuffleItems(items: MediaItem[], avoidFirstId?: string): MediaItem[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (avoidFirstId && shuffled.length > 1 && shuffled[0].id === avoidFirstId) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function renderMetaPart(part: HeroMetaPart) {
  switch (part.kind) {
    case 'type':
      return (
        <>
          <span className="hero__meta-icon" aria-hidden="true">
            <MediaPosterGlyph />
          </span>
          <span className="hero__meta-text media-pearl-text">{part.value}</span>
        </>
      );
    case 'duration':
      return (
        <>
          <ClockIcon size={16} className="hero__meta-item-icon" strokeWidth={1.75} aria-hidden />
          <span className="hero__meta-text media-pearl-text">{part.value}</span>
        </>
      );
    case 'age':
      return <span className="hero__meta-age-badge">{part.value}+</span>;
    case 'rating':
      return <HeroRating rating={part.value} />;
    case 'text':
      return <span className="hero__meta-text">{part.value}</span>;
  }
}

function getMetaPartKey(part: HeroMetaPart, index: number): string {
  if (part.kind === 'rating') {
    return `rating-${part.value}`;
  }

  if (part.kind === 'age') {
    return `age-${part.value}`;
  }

  return `${part.kind}-${part.value}-${index}`;
}

function createSlideQueue(items: MediaItem[], avoidFirstId?: string): MediaItem[] {
  if (items.length <= 1) {
    return items;
  }

  return shuffleItems(items, avoidFirstId);
}

export function HeroBanner({ items, autoSlide, slideIntervalSec, onPlay, onInfo }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoSlideItem, setAutoSlideItem] = useState(items[0]);
  const slideQueueRef = useRef<MediaItem[]>([]);
  const slideIndexRef = useRef(0);

  useEffect(() => {
    slideQueueRef.current = createSlideQueue(items);
    slideIndexRef.current = 0;
    setActiveIndex(0);
    setAutoSlideItem(slideQueueRef.current[0] ?? items[0]);
  }, [items]);

  useEffect(() => {
    if (!autoSlide || items.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setAutoSlideItem((current) => {
        slideIndexRef.current += 1;

        if (
          slideQueueRef.current.length === 0 ||
          slideIndexRef.current >= slideQueueRef.current.length
        ) {
          slideQueueRef.current = createSlideQueue(items, current.id);
          slideIndexRef.current = 0;
        }

        return slideQueueRef.current[slideIndexRef.current] ?? current;
      });
    }, slideIntervalSec * 1000);

    return () => window.clearInterval(timer);
  }, [items, autoSlide, slideIntervalSec]);

  const item = autoSlide ? autoSlideItem : (items[activeIndex] ?? items[0]);
  const showSlideDots = !autoSlide && items.length > 1;

  const metaParts = buildMetaParts(item);
  const { src: heroSrc, failed: heroImageFailed, ready: heroReady, loading, onError } = useMediaImage({
    primaryUrl: item.backdrop || item.poster,
    fallbackUrl: item.poster,
    eager: true,
  });
  const { src: logoSrc, failed: logoFailed } = useMediaImage({
    primaryUrl: item.logo ?? '',
    eager: true,
  });
  const showLogo = Boolean(item.logo && logoSrc && !logoFailed);

  const hasHeroSource = Boolean(item.backdrop || item.poster);
  const isHeroLoading = hasHeroSource && !heroImageFailed && !heroReady;
  const showHeroImage = Boolean(heroSrc) && !heroImageFailed && heroReady;

  return (
    <section className="hero">
      <div className="hero__backdrop" aria-hidden="true">
        <div className="hero__image-panel">
          {isHeroLoading ? <MediaCoverPlaceholder className="hero__cover-placeholder" fill /> : null}
          {showHeroImage ? (
            <img
              key={heroSrc}
              className="hero__backdrop-image hero__backdrop-image--ready"
              src={heroSrc}
              alt=""
              loading={loading}
              referrerPolicy="no-referrer"
              onError={onError}
            />
          ) : null}
        </div>
      </div>

      <div key={item.id} className="hero__content hero__content--enter">
        <div className="hero__brand">
          {showLogo ? (
            <img
              key={logoSrc}
              className="hero__logo"
              src={logoSrc}
              alt={item.title}
              loading="eager"
              referrerPolicy="no-referrer"
            />
          ) : (
            <h2 className="hero__title media-pearl-text">{item.title}</h2>
          )}
        </div>

        {metaParts.length > 0 ? (
          <p className="hero__meta">
            {metaParts.map((part, index) => (
              <Fragment key={getMetaPartKey(part, index)}>
                {index > 0 ? <span className="hero__meta-sep" aria-hidden="true" /> : null}
                <span className="hero__meta-item">{renderMetaPart(part)}</span>
              </Fragment>
            ))}
          </p>
        ) : null}

        {item.description && <p className="hero__description">{item.description}</p>}

        <div className="hero__actions">
          <button className="hero__btn hero__btn--primary" onClick={() => onPlay(item)}>
            <PlayIcon size={22} />
            Смотреть
          </button>
          <button className="hero__btn hero__btn--ghost" onClick={() => onInfo(item)}>
            <InfoIcon size={22} />
            Подробнее
          </button>
        </div>
      </div>

      {showSlideDots ? (
        <div className="hero__dots" role="tablist" aria-label="Слайды рекомендаций">
          {items.map((slideItem, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={slideItem.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Слайд ${index + 1}: ${slideItem.title}`}
                className={`hero__dot${isActive ? ' hero__dot--active' : ''}`}
                onClick={() => setActiveIndex(index)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
