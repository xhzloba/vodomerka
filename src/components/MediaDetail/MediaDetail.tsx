import { Fragment, useCallback, useEffect, useMemo, useState, type MouseEvent, type RefObject } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import { useInAppTrailer } from '@/shared/media/useInAppTrailer';
import { MediaCoverPlaceholder, MediaPosterGlyph } from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';
import { useOverriddenMediaItem } from '@/shared/hooks/useOverriddenMediaItem';
import { copyText } from '@/shared/lib/copyText';
import { HeroRating } from '@/shared/ui/HeroRating/HeroRating';
import { MediaDescriptionDialog } from '@/shared/ui/MediaDescriptionDialog/MediaDescriptionDialog';
import { MediaTorrentsDialog } from '@/shared/ui/MediaTorrentsDialog/MediaTorrentsDialog';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import {
  ClockIcon,
  CloseIcon,
  BanIcon,
  DownloadIcon,
  EyeIcon,
  FavoritesIcon,
  InfoIcon,
  LayersIcon,
  PauseBarsIcon,
  PauseCircleIcon,
  PlayIcon,
  SparklesIcon,
  WatchingIcon,
} from '@/shared/ui/icons';
import { WATCH_STATUS_LABELS, WATCH_STATUSES, type WatchStatus } from '@/shared/domain/watchStatus';
import { WatchStatusPicker } from './WatchStatusPicker';
import { RelatedTitlesDialog } from './RelatedTitlesDialog';
import { DetailCastStrip } from './DetailCastStrip';
import { DetailGenresMore } from './DetailGenresMore';
import '../HeroBanner/HeroBanner.css';
import './MediaDetail.css';

interface MediaDetailProps {
  item: MediaItem;
  variant?: 'modal' | 'window' | 'panel';
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
  onSelect?: (item: MediaItem) => void;
}

type DetailMetaPart =
  | { kind: 'type'; value: string }
  | { kind: 'text'; value: string }
  | { kind: 'duration'; value: string }
  | { kind: 'age'; value: number }
  | { kind: 'rating'; value: number };

function buildDetailMetaParts(item: MediaItem): DetailMetaPart[] {
  return [
    { kind: 'type', value: getMediaTypeLabel(item.type) },
    item.year != null ? { kind: 'text', value: String(item.year) } : null,
    item.duration ? { kind: 'duration', value: item.duration } : null,
    item.age != null ? { kind: 'age', value: item.age } : null,
    item.rating != null ? { kind: 'rating', value: item.rating } : null,
    item.genres[0] ? { kind: 'text', value: item.genres[0] } : null,
  ].filter((part): part is DetailMetaPart => part != null && part.value !== '');
}

function getDetailMetaPartKey(part: DetailMetaPart, index: number): string {
  if (part.kind === 'rating') {
    return `rating-${part.value}`;
  }

  if (part.kind === 'age') {
    return `age-${part.value}`;
  }

  return `${part.kind}-${part.value}-${index}`;
}

function renderDetailMetaPart(part: DetailMetaPart) {
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

function uniqueBackdropUrls(item: MediaItem): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...(item.backdrops ?? []), item.backdrop]) {
    const url = raw?.trim();
    if (!url || seen.has(url)) {
      continue;
    }
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

const BACKDROP_ROTATE_MS = 5000;

function DetailTrailerVideo({
  mediaId,
  videoRef,
  playableTrailerUrl,
  className,
  onLoading,
  onPlaying,
  onEnded,
}: {
  mediaId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  playableTrailerUrl: string | null;
  className: string;
  onLoading: (loading: boolean) => void;
  onPlaying: () => void;
  onEnded: () => void;
}) {
  return (
    <video
      ref={videoRef as RefObject<HTMLVideoElement>}
      key={`detail-trailer-${mediaId}`}
      className={`${className}${playableTrailerUrl ? '' : ' hero__trailer-video--pending'}`}
      autoPlay
      playsInline
      preload="auto"
      controls={false}
      {...{ 'webkit-playsinline': 'true' }}
      disablePictureInPicture
      controlsList="nodownload noplaybackrate nofullscreen noremoteplayback"
      onLoadedData={() => onLoading(false)}
      onWaiting={() => onLoading(true)}
      onPlaying={() => {
        onLoading(false);
        onPlaying();
      }}
      onEnded={onEnded}
    />
  );
}

function MediaDetailBrand({
  logoUrl,
  title,
  variant,
  pending = false,
  onClick,
}: {
  logoUrl?: string;
  title: string;
  variant: 'window' | 'panel' | 'modal';
  pending?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const { src, failed } = useMediaImage({
    primaryUrl: logoUrl ?? '',
    eager: true,
  });
  const [loaded, setLoaded] = useState(false);
  const hasLogoUrl = Boolean(logoUrl);

  useEffect(() => {
    setLoaded(false);
  }, [logoUrl, src]);

  const showLogo = hasLogoUrl && Boolean(src) && loaded && !failed;
  const showLogoSkeleton = !showLogo && ((hasLogoUrl && !failed) || pending);
  const logoClassName = variant === 'window' ? 'hero__logo' : 'media-detail__logo';
  const skeletonClassName = 'hero__logo-skeleton media-detail__logo-skeleton';
  const titleClassName =
    variant === 'window' ? 'hero__title media-pearl-text' : 'media-detail__title media-pearl-text';

  if (showLogoSkeleton || showLogo) {
    return (
      <div className={`media-detail__brand${showLogo ? ' media-detail__brand--ready' : ''}`}>
        {showLogoSkeleton ? <div className={skeletonClassName} aria-hidden="true" /> : null}
        {src && !failed ? (
          <img
            className={logoClassName}
            src={src}
            alt={showLogo ? title : ''}
            loading="eager"
            referrerPolicy="no-referrer"
            onClick={onClick}
            onLoad={() => setLoaded(true)}
            ref={(node) => {
              if (node?.complete && node.naturalWidth > 0) {
                requestAnimationFrame(() => setLoaded(true));
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <h2 className={titleClassName} onClick={onClick}>
      {title}
    </h2>
  );
}

export function MediaDetail({ item, variant = 'modal', onClose, onPlay, onSelect }: MediaDetailProps) {
  const detailItem = useOverriddenMediaItem(item);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getStatus, toggleStatus } = useWatched();
  const { trackView } = useRecentlyViewed();
  const { showToast } = useToast();
  const [isPendingFavorite, setIsPendingFavorite] = useState<boolean | null>(null);
  const [pendingStatus, setPendingStatus] = useState<WatchStatus | 'none' | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [relatedSheet, setRelatedSheet] = useState<'sequels' | 'similars' | null>(null);
  const [torrentsOpen, setTorrentsOpen] = useState(false);
  const [torrentsMounted, setTorrentsMounted] = useState(false);
  const [backdropIndex, setBackdropIndex] = useState(0);
  const {
    playableTrailerUrl,
    isTrailerArmed,
    isTrailerLoading,
    showTrailerButton,
    trailerVideoRef,
    toggleTrailer,
    stopTrailer,
    setTrailerLoading,
  } = useInAppTrailer(detailItem.id, detailItem.trailerUrl);
  const inFavorites = isPendingFavorite ?? isFavorite(detailItem.id);
  const watchStatus =
    pendingStatus === null
      ? getStatus(detailItem.id)
      : pendingStatus === 'none'
        ? null
        : pendingStatus;
  const isWindow = variant === 'window';
  const isPanel = variant === 'panel';
  const metaParts = buildDetailMetaParts(detailItem);

  const backdropUrls = useMemo(() => uniqueBackdropUrls(detailItem), [detailItem]);
  const activeBackdrop = backdropUrls[backdropIndex] ?? (detailItem.backdrop || detailItem.poster);
  const nextBackdrop =
    backdropUrls.length > 1 ? backdropUrls[(backdropIndex + 1) % backdropUrls.length] : '';

  useEffect(() => {
    setIsPendingFavorite(null);
    setPendingStatus(null);
    setDescriptionOpen(false);
    setRelatedSheet(null);
    setTorrentsOpen(false);
    setBackdropIndex(0);
  }, [detailItem.id]);

  const openTorrents = useCallback(() => {
    setTorrentsMounted(true);
    setTorrentsOpen(true);
  }, []);

  useEffect(() => {
    void trackView(detailItem);
  }, [detailItem.id, detailItem, trackView]);

  useEffect(() => {
    if (backdropUrls.length <= 1 || isTrailerArmed) {
      return;
    }

    const timer = window.setInterval(() => {
      setBackdropIndex((current) => (current + 1) % backdropUrls.length);
    }, BACKDROP_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [backdropUrls, isTrailerArmed]);

  const { src, failed, ready: heroReady, loading, onError } = useMediaImage({
    primaryUrl: activeBackdrop,
    fallbackUrl: detailItem.poster,
    eager: true,
  });
  useMediaImage({
    primaryUrl: nextBackdrop,
    eager: Boolean(nextBackdrop),
  });
  const { src: posterSrc, failed: posterFailed, ready: posterReady } = useMediaImage({
    primaryUrl: detailItem.poster,
    fallbackUrl: detailItem.backdrop,
    eager: true,
  });

  const [pinnedHeroSrc, setPinnedHeroSrc] = useState('');
  useEffect(() => {
    setPinnedHeroSrc('');
  }, [detailItem.id]);
  useEffect(() => {
    if (src && heroReady && !failed) {
      setPinnedHeroSrc(src);
    }
  }, [failed, heroReady, src]);

  const hasPosterSource = Boolean(detailItem.poster || detailItem.backdrop);
  const isPosterLoading = hasPosterSource && !posterFailed && !posterReady;
  const showPoster = hasPosterSource && !posterFailed && posterReady;
  const hasHeroSource = Boolean(activeBackdrop || detailItem.poster);
  const displayHeroSrc = pinnedHeroSrc || src;
  const isHeroLoading = hasHeroSource && !failed && !displayHeroSrc;
  const logoPending = detailItem.related === undefined;
  const showHeroImage = Boolean(displayHeroSrc) && !failed;

  const handleCopyId = useCallback(
    async (event: MouseEvent) => {
      event.stopPropagation();
      const ok = await copyText(detailItem.id);
      showToast(ok ? detailItem.id : 'Не удалось скопировать ID', {
        kind: 'copy',
        title: ok ? 'ID скопирован' : 'Ошибка',
      });
    },
    [detailItem.id, showToast],
  );

  const handleToggleFavorite = useCallback(async () => {
    const nextState = !inFavorites;
    setIsPendingFavorite(nextState);

    try {
      const added = await toggleFavorite(detailItem);
      setIsPendingFavorite(added);
      showToast(
        added ? `«${detailItem.title}» в избранном` : `«${detailItem.title}» убрано из избранного`,
        {
          kind: 'favorite',
          title: added ? 'Добавлено' : 'Удалено',
        },
      );
    } catch {
      setIsPendingFavorite(null);
    }
  }, [detailItem, inFavorites, showToast, toggleFavorite]);

  const handleToggleStatus = useCallback(
    async (status: WatchStatus) => {
      const next = watchStatus === status ? 'none' : status;
      setPendingStatus(next);

      try {
        const added = await toggleStatus(detailItem, status);
        setPendingStatus(added ? status : 'none');
        showToast(
          added
            ? `«${detailItem.title}» → ${WATCH_STATUS_LABELS[status]}`
            : `«${detailItem.title}» убрано из «${WATCH_STATUS_LABELS[status]}»`,
          {
            kind: added ? 'restore' : 'hide',
            title: added ? WATCH_STATUS_LABELS[status] : 'Убрано',
          },
        );
      } catch {
        setPendingStatus(null);
      }
    },
    [detailItem, showToast, toggleStatus, watchStatus],
  );

  const metaRow =
    metaParts.length > 0 ? (
      <p className="hero__meta">
        {metaParts.map((part, index) => (
          <Fragment key={getDetailMetaPartKey(part, index)}>
            {index > 0 ? <span className="hero__meta-sep" aria-hidden="true" /> : null}
            <span className="hero__meta-item">{renderDetailMetaPart(part)}</span>
          </Fragment>
        ))}
      </p>
    ) : null;

  const factsBlock =
    detailItem.director || detailItem.country || detailItem.genres.length > 1 ? (
      <div className="media-detail__facts">
        {detailItem.genres.length > 1 ? (
          <p className="media-detail__fact">
            <span className="media-detail__fact-label">Жанры</span>
            <span className="media-detail__fact-value">{detailItem.genres.join(', ')}</span>
          </p>
        ) : null}
        {detailItem.director ? (
          <p className="media-detail__fact">
            <span className="media-detail__fact-label">Режиссёр</span>
            <span className="media-detail__fact-value">{detailItem.director}</span>
          </p>
        ) : null}
        {detailItem.country ? (
          <p className="media-detail__fact">
            <span className="media-detail__fact-label">Страна</span>
            <span className="media-detail__fact-value">{detailItem.country}</span>
          </p>
        ) : null}
      </div>
    ) : null;

  const statusButtons = (
    <div className="media-detail__status-group" role="group" aria-label="Статус просмотра">
      {WATCH_STATUSES.map((status) => {
        const active = watchStatus === status;
        return (
          <button
            key={status}
            type="button"
            className={`media-detail__icon-btn media-detail__icon-btn--${status}${
              active ? ' media-detail__icon-btn--active' : ''
            }`}
            onClick={() => void handleToggleStatus(status)}
            aria-label={WATCH_STATUS_LABELS[status]}
            aria-pressed={active}
            title={WATCH_STATUS_LABELS[status]}
          >
            {status === 'watching' ? (
              <WatchingIcon size={18} strokeWidth={active ? 2 : 1.75} />
            ) : status === 'watched' ? (
              <EyeIcon size={18} strokeWidth={active ? 2 : 1.75} />
            ) : status === 'postponed' ? (
              <PauseCircleIcon size={18} strokeWidth={active ? 2 : 1.75} />
            ) : (
              <BanIcon size={18} strokeWidth={active ? 2 : 1.75} />
            )}
          </button>
        );
      })}
    </div>
  );

  const actions = (
    <div className="media-detail__actions">
      <button
        type="button"
        className="hero__btn hero__btn--primary media-detail__play-btn"
        onClick={() => onPlay(detailItem)}
      >
        <PlayIcon size={18} />
        Смотреть
      </button>
      {showTrailerButton ? (
        <button
          type="button"
          className={`hero__btn hero__btn--ghost hero__btn--trailer${
            isTrailerArmed ? ' hero__btn--trailer-active' : ''
          }`}
          aria-pressed={isTrailerArmed}
          aria-label={isTrailerArmed ? 'Остановить трейлер' : 'Смотреть трейлер'}
          onClick={toggleTrailer}
        >
          <span className="hero__btn-icon" aria-hidden="true">
            {isTrailerArmed ? <PauseBarsIcon size={15} /> : <PlayIcon size={15} />}
          </span>
          <span className="hero__btn-label">{isTrailerArmed ? 'Стоп' : 'Трейлер'}</span>
        </button>
      ) : null}
      {isPanel ? (
        <button
          type="button"
          className="media-detail__icon-btn media-detail__download-btn"
          onClick={openTorrents}
          aria-label="Скачать"
          title="Скачать"
        >
          <DownloadIcon size={18} />
        </button>
      ) : null}
      <button
        type="button"
        className={`media-detail__icon-btn media-detail__icon-btn--favorite${
          inFavorites ? ' media-detail__icon-btn--active' : ''
        }`}
        onClick={() => void handleToggleFavorite()}
        aria-label={inFavorites ? 'Убрать из избранного' : 'Добавить в избранное'}
        aria-pressed={inFavorites}
        title={inFavorites ? 'В избранном' : 'В избранное'}
      >
        <FavoritesIcon size={18} filled={inFavorites} />
      </button>
      {!isPanel ? statusButtons : null}
      {!isWindow && !isPanel && detailItem.description ? (
        <button
          type="button"
          className="hero__btn hero__btn--ghost media-detail__info-btn"
          onClick={() => setDescriptionOpen(true)}
        >
          <InfoIcon size={18} />
          Описание
        </button>
      ) : null}
      {!isWindow && !isPanel ? (
        <button type="button" className="hero__btn hero__btn--ghost" onClick={onClose}>
          Закрыть
        </button>
      ) : null}
    </div>
  );

  const descriptionDialog = (
    <MediaDescriptionDialog
      open={descriptionOpen && Boolean(detailItem.description)}
      title={detailItem.title}
      description={detailItem.description}
      genres={detailItem.genres}
      onClose={() => setDescriptionOpen(false)}
    />
  );

  const torrentsDialog = torrentsMounted ? (
    <MediaTorrentsDialog
      open={torrentsOpen}
      mediaId={detailItem.id}
      title={detailItem.title}
      subtitle={detailItem.subtitle}
      year={detailItem.year}
      type={detailItem.type}
      posterUrl={detailItem.poster || undefined}
      onClose={() => setTorrentsOpen(false)}
    />
  ) : null;

  const relatedItems = detailItem.related ?? [];
  const similarItems = detailItem.similars ?? [];
  const relatedAllItems = useMemo(() => {
    if (relatedItems.length === 0) {
      return [];
    }

    if (relatedItems.some((row) => row.id === detailItem.id)) {
      return relatedItems;
    }

    return [...relatedItems, detailItem].sort(
      (left, right) => (left.year ?? 99999) - (right.year ?? 99999),
    );
  }, [detailItem, relatedItems]);
  const canOpenRelated = relatedItems.length > 0 && Boolean(onSelect);
  const canOpenSimilars = similarItems.length > 0 && Boolean(onSelect);
  const relatedDialog =
    (canOpenRelated || canOpenSimilars) && onSelect ? (
      <RelatedTitlesDialog
        open={relatedSheet != null}
        title={relatedSheet === 'similars' ? 'Похожие фильмы' : 'Сиквелы и приквелы'}
        items={relatedSheet === 'similars' ? similarItems : relatedAllItems}
        currentId={relatedSheet === 'sequels' ? detailItem.id : undefined}
        onClose={() => setRelatedSheet(null)}
        onSelect={onSelect}
      />
    ) : null;
  const relatedButton =
    canOpenRelated || canOpenSimilars ? (
      <section className="media-detail__franchise">
        {canOpenRelated ? (
          <button
            type="button"
            className="media-detail__franchise-btn"
            onClick={() => setRelatedSheet('sequels')}
          >
            <LayersIcon size={18} />
            <span className="media-detail__franchise-label">Сиквелы и приквелы</span>
            <span className="media-detail__franchise-count">{relatedAllItems.length}</span>
          </button>
        ) : null}
        {canOpenSimilars ? (
          <button
            type="button"
            className="media-detail__franchise-btn"
            onClick={() => setRelatedSheet('similars')}
          >
            <SparklesIcon size={18} />
            <span className="media-detail__franchise-label">Похожие фильмы</span>
            <span className="media-detail__franchise-count">{similarItems.length}</span>
          </button>
        ) : null}
      </section>
    ) : null;

  if (isWindow) {
    const cast = detailItem.cast ?? [];
    const typeLabel = getMediaTypeLabel(detailItem.type);
    const chipItems = [
      { key: 'type', node: typeLabel },
      detailItem.year != null ? { key: 'year', node: String(detailItem.year) } : null,
      detailItem.duration ? { key: 'duration', node: detailItem.duration } : null,
      detailItem.age != null ? { key: 'age', node: `${detailItem.age}+` } : null,
      detailItem.country ? { key: 'country', node: detailItem.country } : null,
    ].filter((chip): chip is { key: string; node: string } => chip != null);

    const genres = detailItem.genres;
    const extraGenres = genres.slice(1);

    return (
      <div className="media-detail media-detail--window">
        <div className="media-detail__panel">
          <div className="mdw">
            <header className="mdw-masthead">
              <div className="mdw-masthead__media" aria-hidden="true">
                {isTrailerArmed ? (
                  <DetailTrailerVideo
                    mediaId={detailItem.id}
                    videoRef={trailerVideoRef}
                    playableTrailerUrl={playableTrailerUrl}
                    className="mdw-masthead__video"
                    onLoading={setTrailerLoading}
                    onPlaying={() => setTrailerLoading(false)}
                    onEnded={stopTrailer}
                  />
                ) : null}
                {!isTrailerArmed && isHeroLoading ? (
                  <MediaCoverPlaceholder className="mdw-masthead__placeholder" fill />
                ) : null}
                {!isTrailerArmed && showHeroImage ? (
                  <img
                    key={displayHeroSrc}
                    className="mdw-masthead__image mdw-masthead__image--ready"
                    src={displayHeroSrc}
                    alt=""
                    loading={loading}
                    referrerPolicy="no-referrer"
                    onError={onError}
                    onClick={(event) => void handleCopyId(event)}
                  />
                ) : null}
                {isTrailerArmed && (isTrailerLoading || !playableTrailerUrl) ? (
                  <MediaCoverPlaceholder className="mdw-masthead__placeholder" fill />
                ) : null}
              </div>
              <div className="mdw-masthead__fade" />

              <div className="mdw-identity">
                <div className="mdw-poster">
                  {isPosterLoading ? (
                    <MediaCoverPlaceholder className="mdw-poster__placeholder" fill />
                  ) : null}
                  {showPoster ? (
                    <img
                      key={posterSrc}
                      className="mdw-poster__image mdw-poster__image--ready"
                      src={posterSrc}
                      alt={detailItem.title}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onClick={(event) => void handleCopyId(event)}
                    />
                  ) : null}
                </div>

                <div className="mdw-identity__main">
                  <div className="mdw-identity__heading">
                    <MediaDetailBrand
                      key={`${detailItem.id}:${detailItem.logo ?? ''}`}
                      logoUrl={detailItem.logo}
                      title={detailItem.title}
                      variant="window"
                      pending={logoPending}
                      onClick={(event) => void handleCopyId(event)}
                    />
                    {detailItem.director ? (
                      <p className="mdw-identity__subtitle">{detailItem.director}</p>
                    ) : detailItem.subtitle ? (
                      <p className="mdw-identity__subtitle">{detailItem.subtitle}</p>
                    ) : null}
                  </div>

                  <div className="mdw-chips">
                    {detailItem.rating != null ? (
                      <span className="mdw-chip mdw-chip--rating">
                        <HeroRating rating={detailItem.rating} />
                      </span>
                    ) : null}
                    {chipItems.map((chip) => (
                      <span key={chip.key} className="mdw-chip">
                        {chip.node}
                      </span>
                    ))}
                    {genres[0] ? <span className="mdw-chip">{genres[0]}</span> : null}
                    {extraGenres.length > 0 ? <DetailGenresMore genres={extraGenres} /> : null}
                  </div>

                  <div className="mdw-toolbar">
                    <button
                      type="button"
                      className="mdw-btn mdw-btn--primary"
                      onClick={() => onPlay(detailItem)}
                    >
                      <PlayIcon size={17} />
                      Смотреть
                    </button>
                    {showTrailerButton ? (
                      <button
                        type="button"
                        className={`mdw-btn mdw-btn--secondary${isTrailerArmed ? ' mdw-btn--active' : ''}`}
                        aria-pressed={isTrailerArmed}
                        onClick={toggleTrailer}
                      >
                        {isTrailerArmed ? <PauseBarsIcon size={16} /> : <PlayIcon size={16} />}
                        {isTrailerArmed ? 'Стоп' : 'Трейлер'}
                      </button>
                    ) : null}

                    <div className="mdw-toolbar__rail" role="group" aria-label="Избранное и статус">
                      <button
                        type="button"
                        className={`mdw-icon${inFavorites ? ' mdw-icon--on' : ''}`}
                        onClick={() => void handleToggleFavorite()}
                        aria-label={inFavorites ? 'Убрать из избранного' : 'В избранное'}
                        aria-pressed={inFavorites}
                        title={inFavorites ? 'В избранном' : 'В избранное'}
                      >
                        <FavoritesIcon size={17} filled={inFavorites} />
                      </button>
                      {WATCH_STATUSES.map((status) => {
                        const active = watchStatus === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            className={`mdw-icon${active ? ' mdw-icon--on' : ''}`}
                            onClick={() => void handleToggleStatus(status)}
                            aria-label={WATCH_STATUS_LABELS[status]}
                            aria-pressed={active}
                            title={WATCH_STATUS_LABELS[status]}
                          >
                            {status === 'watching' ? (
                              <WatchingIcon size={17} strokeWidth={active ? 2 : 1.75} />
                            ) : status === 'watched' ? (
                              <EyeIcon size={17} strokeWidth={active ? 2 : 1.75} />
                            ) : status === 'postponed' ? (
                              <PauseCircleIcon size={17} strokeWidth={active ? 2 : 1.75} />
                            ) : (
                              <BanIcon size={17} strokeWidth={active ? 2 : 1.75} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="mdw-body">
              {detailItem.description ? (
                <section className="mdw-section">
                  <h2 className="mdw-section__title">Описание</h2>
                  <p className="mdw-section__text">{detailItem.description}</p>
                </section>
              ) : null}

              {cast.length > 0 ? (
                <section className="mdw-section mdw-section--cast">
                  <DetailCastStrip cast={cast} />
                </section>
              ) : null}

              {canOpenRelated || canOpenSimilars ? (
                <section className="mdw-section">
                  <h2 className="mdw-section__title">Ещё</h2>
                  <div className="mdw-links">
                    {canOpenRelated ? (
                      <button
                        type="button"
                        className="mdw-link"
                        onClick={() => setRelatedSheet('sequels')}
                      >
                        <LayersIcon size={16} />
                        Сиквелы и приквелы
                        <span className="mdw-link__count">{relatedAllItems.length}</span>
                      </button>
                    ) : null}
                    {canOpenSimilars ? (
                      <button
                        type="button"
                        className="mdw-link"
                        onClick={() => setRelatedSheet('similars')}
                      >
                        <SparklesIcon size={16} />
                        Похожие
                        <span className="mdw-link__count">{similarItems.length}</span>
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
        {descriptionDialog}
        {relatedDialog}
        {torrentsDialog}
      </div>
    );
  }

  const body = (
    <>
      {hasHeroSource ? (
        <div className="media-detail__banner" aria-hidden="true">
          {isTrailerArmed ? (
            <DetailTrailerVideo
              mediaId={detailItem.id}
              videoRef={trailerVideoRef}
              playableTrailerUrl={playableTrailerUrl}
              className="media-detail__banner-video"
              onLoading={setTrailerLoading}
              onPlaying={() => setTrailerLoading(false)}
              onEnded={stopTrailer}
            />
          ) : null}
          {!isTrailerArmed && !showHeroImage ? (
            <MediaCoverPlaceholder
              className="media-detail__banner-placeholder"
              fill
              animate={!failed}
            />
          ) : null}
          {!isTrailerArmed && displayHeroSrc && !failed ? (
            <img
              key={displayHeroSrc}
              className="media-detail__banner-image media-detail__banner-image--ready"
              src={displayHeroSrc}
              alt=""
              loading={loading}
              referrerPolicy="no-referrer"
              onError={onError}
            />
          ) : null}
          {isTrailerArmed && (isTrailerLoading || !playableTrailerUrl) ? (
            <MediaCoverPlaceholder className="media-detail__banner-placeholder" fill />
          ) : null}
        </div>
      ) : null}

      <div className="media-detail__content">
        <div className="media-detail__intro">
          {isPosterLoading ? (
            <MediaCoverPlaceholder className="media-detail__poster-placeholder" />
          ) : null}
          {showPoster ? (
            <img
              key={posterSrc}
              className="media-detail__poster media-detail__poster--ready"
              src={posterSrc}
              alt={detailItem.title}
              loading="eager"
              referrerPolicy="no-referrer"
              onClick={(event) => void handleCopyId(event)}
            />
          ) : null}

          <div className="media-detail__info">
            <MediaDetailBrand
              key={`${detailItem.id}:${detailItem.logo ?? ''}`}
              logoUrl={detailItem.logo}
              title={detailItem.title}
              variant="modal"
              pending={logoPending}
              onClick={(event) => void handleCopyId(event)}
            />

            {detailItem.subtitle ? (
              <p className="media-detail__subtitle">{detailItem.subtitle}</p>
            ) : null}

            {metaRow}

            {detailItem.genres.length > 0 ? (
              <p className="media-detail__genres">{detailItem.genres.join(' · ')}</p>
            ) : null}
          </div>
        </div>

        {detailItem.description ? (
          <p className="media-detail__synopsis">{detailItem.description}</p>
        ) : null}

        {actions}
        {factsBlock}
        {relatedButton}
      </div>
    </>
  );

  if (isPanel) {
    const panelFacts =
      detailItem.director || detailItem.country || detailItem.genres.length > 1 ? (
        <div className="media-detail__facts">
          {detailItem.genres.length > 1 ? (
            <p className="media-detail__fact">
              <span className="media-detail__fact-label">Жанры</span>
              <span className="media-detail__fact-value">{detailItem.genres.join(', ')}</span>
            </p>
          ) : null}
          {detailItem.director ? (
            <p className="media-detail__fact">
              <span className="media-detail__fact-label">Режиссёр</span>
              <span className="media-detail__fact-value">{detailItem.director}</span>
            </p>
          ) : null}
          {detailItem.country ? (
            <p className="media-detail__fact">
              <span className="media-detail__fact-label">Страна</span>
              <span className="media-detail__fact-value">{detailItem.country}</span>
            </p>
          ) : null}
        </div>
      ) : null;

    return (
      <div className="media-detail media-detail--panel">
        <div className="media-detail__panel">
          {hasHeroSource ? (
            <div className="media-detail__banner" aria-hidden="true">
              {isTrailerArmed ? (
                <DetailTrailerVideo
                  mediaId={detailItem.id}
                  videoRef={trailerVideoRef}
                  playableTrailerUrl={playableTrailerUrl}
                  className="media-detail__banner-video"
                  onLoading={setTrailerLoading}
                  onPlaying={() => setTrailerLoading(false)}
                  onEnded={stopTrailer}
                />
              ) : null}
              {!isTrailerArmed && !showHeroImage ? (
                <MediaCoverPlaceholder
                  className="media-detail__banner-placeholder"
                  fill
                  animate={!failed}
                />
              ) : null}
              {!isTrailerArmed && displayHeroSrc && !failed ? (
                <img
                  key={displayHeroSrc}
                  className="media-detail__banner-image media-detail__banner-image--ready"
                  src={displayHeroSrc}
                  alt=""
                  loading={loading}
                  referrerPolicy="no-referrer"
                  onError={onError}
                />
              ) : null}
              {isTrailerArmed && (isTrailerLoading || !playableTrailerUrl) ? (
                <MediaCoverPlaceholder className="media-detail__banner-placeholder" fill />
              ) : null}
            </div>
          ) : null}

          <div
            className={`media-detail__content${hasHeroSource ? ' media-detail__content--under-banner' : ''}`}
          >
            <div className="media-detail__intro">
              <div className="media-detail__info">
                <MediaDetailBrand
                  key={`${detailItem.id}:${detailItem.logo ?? ''}`}
                  logoUrl={detailItem.logo}
                  title={detailItem.title}
                  variant="panel"
                  pending={logoPending}
                  onClick={(event) => void handleCopyId(event)}
                />
                {detailItem.subtitle && detailItem.subtitle !== detailItem.title ? (
                  <p className="media-detail__subtitle">{detailItem.subtitle}</p>
                ) : null}
                {metaRow}
              </div>
            </div>

            {detailItem.description ? (
              <section className="media-detail__description">
                <h3 className="media-detail__section-title">Описание</h3>
                <div className="media-detail__synopsis">
                  <p className="media-detail__synopsis-text">{detailItem.description}</p>
                  <button
                    type="button"
                    className="media-detail__more-btn"
                    onClick={() => setDescriptionOpen(true)}
                  >
                    Подробнее
                  </button>
                </div>
              </section>
            ) : null}

            <section className="media-detail__actions-block">
              <h3 className="media-detail__section-title">Просмотр</h3>
              {actions}
            </section>

            <section className="media-detail__status-block">
              <h3 className="media-detail__section-title">Статус</h3>
              <WatchStatusPicker
                key={detailItem.id}
                value={watchStatus}
                onSelect={(status) => void handleToggleStatus(status)}
              />
            </section>

            {panelFacts}
            {relatedButton}
          </div>
        </div>
        {descriptionDialog}
        {relatedDialog}
        {torrentsDialog}
      </div>
    );
  }

  return (
    <div className="media-detail" onClick={onClose}>
      <div className="media-detail__backdrop" />
      <div className="media-detail__snake" onClick={(event) => event.stopPropagation()}>
        <div className="media-detail__snake-ring" aria-hidden="true">
          <div className="media-detail__snake-beam media-detail__snake-beam--trail" />
          <div className="media-detail__snake-beam media-detail__snake-beam--core" />
        </div>

        <div className="media-detail__panel">
          <button type="button" className="media-detail__close" onClick={onClose} aria-label="Закрыть">
            <CloseIcon size={18} />
          </button>
          {body}
        </div>
      </div>

      {descriptionDialog}
      {relatedDialog}
      {torrentsDialog}
    </div>
  );
}
