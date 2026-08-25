import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { fetchMediaById } from '@/shared/api/vokino/media';
import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { useHeroManualSwipe } from '@/shared/hooks/useHeroManualSwipe';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import { createInAppHlsPlayer, toPlayableHlsUrl } from '@/shared/media/createInAppHlsPlayer';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { usePosterThemeSource } from '@/shared/theme/usePosterThemeSource';
import {
  MediaCoverPlaceholder,
  MediaPosterGlyph,
} from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';
import { HeroRating } from '@/shared/ui/HeroRating/HeroRating';
import { ClockIcon, InfoIcon, PauseBarsIcon, PlayIcon } from '@/shared/ui/icons';
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

async function startVideoWithAutoplayFallback(video: HTMLVideoElement): Promise<boolean> {
  video.muted = false;
  video.volume = 1;
  try {
    await video.play();
    return true;
  } catch {
    // Autoplay with sound may be blocked — retry muted, then unmute.
  }

  try {
    video.muted = true;
    await video.play();
    video.muted = false;
    video.volume = 1;
    return true;
  } catch {
    return false;
  }
}

export function HeroBanner({ items, autoSlide, slideIntervalSec, onPlay, onInfo }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoSlideItem, setAutoSlideItem] = useState(items[0]);
  const slideQueueRef = useRef<MediaItem[]>([]);
  const slideIndexRef = useRef(0);
  const heroRef = useRef<HTMLElement>(null);
  const trailerVideoRef = useRef<HTMLVideoElement>(null);
  const trailerHlsRef = useRef<Hls | null>(null);
  const trailerCacheRef = useRef<Map<string, string | null>>(new Map());
  const playableTrailerCacheRef = useRef<Map<string, string | null>>(new Map());
  const [trailerUrls, setTrailerUrls] = useState<Record<string, string | null>>({});
  const [playableTrailerUrls, setPlayableTrailerUrls] = useState<Record<string, string | null>>({});
  const [activeTrailerItemId, setActiveTrailerItemId] = useState<string | null>(null);
  const [isTrailerLoading, setIsTrailerLoading] = useState(false);

  useEffect(() => {
    slideQueueRef.current = createSlideQueue(items);
    slideIndexRef.current = 0;
    setActiveIndex(0);
    setAutoSlideItem(slideQueueRef.current[0] ?? items[0]);
  }, [items]);

  useEffect(() => {
    // Pause auto-slide while trailer is playing; resume when stopped.
    if (!autoSlide || items.length <= 1 || activeTrailerItemId != null) {
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
  }, [items, autoSlide, slideIntervalSec, activeTrailerItemId]);

  const item = autoSlide ? autoSlideItem : (items[activeIndex] ?? items[0]);
  const showSlideDots = !autoSlide && items.length > 1;
  const manualSwipeEnabled = showSlideDots;
  const cachedTrailerUrl = trailerUrls[item.id];
  const trailerUrl = item.trailerUrl ?? cachedTrailerUrl ?? null;
  const playableTrailerUrl = playableTrailerUrls[item.id] ?? null;
  const isTrailerArmed = activeTrailerItemId === item.id;

  const handleManualSwipe = useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((current) => {
        const total = items.length;
        if (total <= 1) {
          return current;
        }

        return (current + direction + total) % total;
      });
    },
    [items.length],
  );

  useHeroManualSwipe(heroRef, {
    enabled: manualSwipeEnabled,
    onSwipe: handleManualSwipe,
  });

  useEffect(() => {
    setActiveTrailerItemId(null);
    setIsTrailerLoading(false);
    trailerVideoRef.current?.pause();
    trailerHlsRef.current?.destroy();
    trailerHlsRef.current = null;
  }, [item.id]);

  useEffect(() => {
    if (item.trailerUrl) {
      trailerCacheRef.current.set(item.id, item.trailerUrl);
      setTrailerUrls((current) =>
        current[item.id] === item.trailerUrl
          ? current
          : { ...current, [item.id]: item.trailerUrl ?? null },
      );
      return;
    }

    if (trailerCacheRef.current.has(item.id)) {
      const cached = trailerCacheRef.current.get(item.id) ?? null;
      setTrailerUrls((current) => (current[item.id] === cached ? current : { ...current, [item.id]: cached }));
      return;
    }

    let cancelled = false;
    void fetchMediaById(item.id)
      .then((resolved) => {
        if (cancelled) {
          return;
        }
        const nextUrl = resolved?.trailerUrl ?? null;
        trailerCacheRef.current.set(item.id, nextUrl);
        setTrailerUrls((current) => ({ ...current, [item.id]: nextUrl }));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        trailerCacheRef.current.set(item.id, null);
        setTrailerUrls((current) => ({ ...current, [item.id]: null }));
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, item.trailerUrl]);

  useEffect(() => {
    if (!trailerUrl) {
      setPlayableTrailerUrls((current) =>
        current[item.id] == null ? current : { ...current, [item.id]: null },
      );
      return;
    }

    if (playableTrailerCacheRef.current.has(item.id)) {
      const cached = playableTrailerCacheRef.current.get(item.id) ?? null;
      setPlayableTrailerUrls((current) =>
        current[item.id] === cached ? current : { ...current, [item.id]: cached },
      );
      return;
    }

    let cancelled = false;
    void toPlayableHlsUrl(trailerUrl)
      .then((proxiedUrl) => {
        if (cancelled) {
          return;
        }
        playableTrailerCacheRef.current.set(item.id, proxiedUrl);
        setPlayableTrailerUrls((current) => ({ ...current, [item.id]: proxiedUrl }));
        // Warm proxy + CDN master so first click doesn't hit cold 502.
        void fetch(proxiedUrl, { method: 'GET', mode: 'cors' }).catch(() => undefined);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        // Last resort: try raw URL (browser/dev without Electron proxy).
        playableTrailerCacheRef.current.set(item.id, trailerUrl);
        setPlayableTrailerUrls((current) => ({ ...current, [item.id]: trailerUrl }));
      });

    return () => {
      cancelled = true;
    };
  }, [item.id, trailerUrl]);

  useLayoutEffect(() => {
    if (!isTrailerArmed || !playableTrailerUrl) {
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let retryTimer = 0;
    let networkRetries = 0;
    let hls: Hls | null = null;

    const cleanupHls = () => {
      if (hls) {
        hls.destroy();
        if (trailerHlsRef.current === hls) {
          trailerHlsRef.current = null;
        }
        hls = null;
      }
    };

    const startOnVideo = (video: HTMLVideoElement) => {
      if (cancelled) {
        return;
      }

      trailerHlsRef.current?.destroy();
      trailerHlsRef.current = null;

      if (!Hls.isSupported()) {
        setIsTrailerLoading(false);
        setActiveTrailerItemId(null);
        return;
      }

      video.pause();
      video.muted = false;
      video.volume = 1;

      hls = createInAppHlsPlayer();
      trailerHlsRef.current = hls;
      hls.loadSource(playableTrailerUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) {
          return;
        }
        void startVideoWithAutoplayFallback(video).then((ok) => {
          if (!ok && !cancelled) {
            setIsTrailerLoading(false);
            setActiveTrailerItemId(null);
          }
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal || !hls) {
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 4) {
          networkRetries += 1;
          window.clearTimeout(retryTimer);
          retryTimer = window.setTimeout(() => {
            if (cancelled || !hls) {
              return;
            }
            try {
              hls.startLoad();
            } catch {
              try {
                hls.loadSource(playableTrailerUrl);
              } catch {
                // fallthrough below on next error
              }
            }
          }, 280 * networkRetries);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try {
            hls.recoverMediaError();
            return;
          } catch {
            // fallthrough
          }
        }

        setIsTrailerLoading(false);
        setActiveTrailerItemId(null);
        cleanupHls();
      });
    };

    const tryStart = () => {
      const video = trailerVideoRef.current;
      if (!video) {
        rafId = window.requestAnimationFrame(tryStart);
        return;
      }
      startOnVideo(video);
    };

    tryStart();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(retryTimer);
      cleanupHls();
    };
  }, [isTrailerArmed, item.id, playableTrailerUrl]);

  const metaParts = buildMetaParts(item);
  const { src: heroSrc, failed: heroImageFailed, ready: heroReady, loading, onError } = useMediaImage({
    primaryUrl: item.backdrop || item.poster,
    fallbackUrl: item.poster,
    eager: true,
  });
  const { settings } = useAppSettings();
  usePosterThemeSource(
    heroReady && !heroImageFailed ? heroSrc : '',
    settings.homeBackdropTint && settings.heroEnabled,
  );
  const { src: logoSrc, failed: logoFailed, ready: logoReady } = useMediaImage({
    primaryUrl: item.logo ?? '',
    eager: true,
  });
  const hasLogoUrl = Boolean(item.logo);
  const showLogo = hasLogoUrl && Boolean(logoSrc) && logoReady && !logoFailed;
  const showLogoSkeleton = hasLogoUrl && !logoFailed && !showLogo;

  const hasHeroSource = Boolean(item.backdrop || item.poster);
  const isHeroLoading = hasHeroSource && !heroImageFailed && !heroReady;
  const showHeroImage = Boolean(heroSrc) && !heroImageFailed && heroReady;
  const showTrailerButton = Boolean(trailerUrl);
  const trailerButtonLabel = isTrailerArmed ? 'Стоп' : 'Трейлер';

  return (
    <section
      ref={heroRef}
      className={`hero${manualSwipeEnabled ? ' hero--swipeable' : ''}`}
    >
      <div className="hero__backdrop" aria-hidden="true">
        <div className="hero__image-panel">
          {isTrailerArmed ? (
            <video
              ref={trailerVideoRef}
              key={`trailer-${item.id}`}
              className={`hero__trailer-video${playableTrailerUrl ? '' : ' hero__trailer-video--pending'}`}
              autoPlay
              playsInline
              preload="auto"
              controls={false}
              {...{ 'webkit-playsinline': 'true' }}
              disablePictureInPicture
              controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
              onLoadedData={() => setIsTrailerLoading(false)}
              onWaiting={() => setIsTrailerLoading(true)}
              onPlaying={() => setIsTrailerLoading(false)}
              onEnded={() => setActiveTrailerItemId(null)}
            />
          ) : null}
          {!isTrailerArmed && isHeroLoading ? <MediaCoverPlaceholder className="hero__cover-placeholder" fill /> : null}
          {!isTrailerArmed && showHeroImage ? (
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
          {isTrailerArmed && (isTrailerLoading || !playableTrailerUrl) ? (
            <MediaCoverPlaceholder className="hero__cover-placeholder" fill />
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
          ) : showLogoSkeleton ? (
            <div className="hero__logo-skeleton" aria-hidden="true" />
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
          <button type="button" className="hero__btn hero__btn--primary" onClick={() => onPlay(item)}>
            <PlayIcon size={16} />
            Смотреть
          </button>
          {showTrailerButton ? (
            <button
              type="button"
              className={`hero__btn hero__btn--ghost hero__btn--trailer${isTrailerArmed ? ' hero__btn--trailer-active' : ''}`}
              aria-pressed={isTrailerArmed}
              aria-label={isTrailerArmed ? 'Остановить трейлер' : 'Смотреть трейлер'}
              onClick={() => {
                setIsTrailerLoading(true);
                setActiveTrailerItemId((current) => (current === item.id ? null : item.id));
              }}
            >
              <span className="hero__btn-icon" aria-hidden="true">
                {isTrailerArmed ? <PauseBarsIcon size={15} /> : <PlayIcon size={15} />}
              </span>
              <span className="hero__btn-label">{trailerButtonLabel}</span>
            </button>
          ) : null}
          <button type="button" className="hero__btn hero__btn--ghost" onClick={() => onInfo(item)}>
            <InfoIcon size={16} />
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
