import { Fragment, useCallback, useEffect, useState, type MouseEvent } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
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
  PauseCircleIcon,
  PlayIcon,
  WatchingIcon,
} from '@/shared/ui/icons';
import { WATCH_STATUS_LABELS, WATCH_STATUSES, type WatchStatus } from '@/shared/domain/watchStatus';
import '../HeroBanner/HeroBanner.css';
import './MediaDetail.css';

interface MediaDetailProps {
  item: MediaItem;
  variant?: 'modal' | 'window' | 'panel';
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
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

export function MediaDetail({ item, variant = 'modal', onClose, onPlay }: MediaDetailProps) {
  const detailItem = useOverriddenMediaItem(item);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getStatus, toggleStatus } = useWatched();
  const { trackView } = useRecentlyViewed();
  const { showToast } = useToast();
  const [isPendingFavorite, setIsPendingFavorite] = useState<boolean | null>(null);
  const [pendingStatus, setPendingStatus] = useState<WatchStatus | 'none' | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [torrentsOpen, setTorrentsOpen] = useState(false);
  const [torrentsMounted, setTorrentsMounted] = useState(false);
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

  useEffect(() => {
    setIsPendingFavorite(null);
    setPendingStatus(null);
    setDescriptionOpen(false);
    setTorrentsOpen(false);
  }, [detailItem.id]);

  const openTorrents = useCallback(() => {
    setTorrentsMounted(true);
    setTorrentsOpen(true);
  }, []);

  useEffect(() => {
    void trackView(detailItem);
  }, [detailItem.id, detailItem, trackView]);

  const { src, failed, ready: heroReady, loading, onError } = useMediaImage({
    primaryUrl: detailItem.backdrop || detailItem.poster,
    fallbackUrl: detailItem.poster,
    eager: true,
  });
  const { src: logoSrc, failed: logoFailed } = useMediaImage({
    primaryUrl: detailItem.logo ?? '',
    eager: true,
  });
  const { src: posterSrc, failed: posterFailed, ready: posterReady } = useMediaImage({
    primaryUrl: detailItem.poster,
    fallbackUrl: detailItem.backdrop,
    eager: true,
  });

  const showLogo = Boolean(detailItem.logo && logoSrc && !logoFailed);
  const hasPosterSource = Boolean(detailItem.poster || detailItem.backdrop);
  const isPosterLoading = hasPosterSource && !posterFailed && !posterReady;
  const showPoster = hasPosterSource && !posterFailed && posterReady;
  const hasHeroSource = Boolean(detailItem.backdrop || detailItem.poster);
  const isHeroLoading = hasHeroSource && !failed && !heroReady;
  const showHeroImage = Boolean(src) && !failed && heroReady;

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

  const titleBlock = showLogo ? (
    <img
      key={logoSrc}
      className="hero__logo"
      src={logoSrc}
      alt={detailItem.title}
      loading="eager"
      referrerPolicy="no-referrer"
    />
  ) : (
    <h2 className="hero__title media-pearl-text">{detailItem.title}</h2>
  );

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

  if (isWindow) {
    return (
      <div className="media-detail media-detail--window">
        <div className="media-detail__panel">
          <div className="media-detail__edge-pulse" aria-hidden="true">
            <span className="media-detail__edge-pulse-core" />
          </div>

          <section className="hero media-detail__window-hero">
            <div className="hero__backdrop" aria-hidden="true">
              <div className="hero__image-panel">
                {isHeroLoading ? <MediaCoverPlaceholder className="hero__cover-placeholder" fill /> : null}
                {showHeroImage ? (
                  <img
                    key={src}
                    className="hero__backdrop-image hero__backdrop-image--ready"
                    src={src}
                    alt=""
                    loading={loading}
                    referrerPolicy="no-referrer"
                    onError={onError}
                    onClick={(event) => void handleCopyId(event)}
                  />
                ) : null}
              </div>
            </div>

            <div className="hero__content media-detail__window-content">
              {titleBlock}
              {detailItem.subtitle ? (
                <p className="media-detail__subtitle">{detailItem.subtitle}</p>
              ) : null}
              {metaRow}
              {detailItem.description ? (
                <p className="hero__description">{detailItem.description}</p>
              ) : null}
              {actions}
              {factsBlock}
            </div>
          </section>
        </div>
        {descriptionDialog}
        {torrentsDialog}
      </div>
    );
  }

  const body = (
    <>
      {hasHeroSource ? (
        <div className="media-detail__banner" aria-hidden="true">
          {!showHeroImage ? (
            <MediaCoverPlaceholder
              className="media-detail__banner-placeholder"
              fill
              animate={!failed}
            />
          ) : null}
          {src && !failed ? (
            <img
              key={src}
              className={`media-detail__banner-image${heroReady ? ' media-detail__banner-image--ready' : ''}`}
              src={src}
              alt=""
              loading={loading}
              referrerPolicy="no-referrer"
              onError={onError}
            />
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
            {showLogo ? (
              <img
                key={logoSrc}
                className="media-detail__logo"
                src={logoSrc}
                alt={detailItem.title}
                loading="eager"
                referrerPolicy="no-referrer"
              />
            ) : (
              <h2 className="media-detail__title media-pearl-text">{detailItem.title}</h2>
            )}

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
              {!showHeroImage ? (
                <MediaCoverPlaceholder
                  className="media-detail__banner-placeholder"
                  fill
                  animate={!failed}
                />
              ) : null}
              {src && !failed ? (
                <img
                  key={src}
                  className={`media-detail__banner-image${heroReady ? ' media-detail__banner-image--ready' : ''}`}
                  src={src}
                  alt=""
                  loading={loading}
                  referrerPolicy="no-referrer"
                  onError={onError}
                />
              ) : null}
            </div>
          ) : null}

          <div
            className={`media-detail__content${hasHeroSource ? ' media-detail__content--under-banner' : ''}`}
          >
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
                {showLogo ? (
                  <img
                    key={logoSrc}
                    className="media-detail__logo"
                    src={logoSrc}
                    alt={detailItem.title}
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <h2 className="media-detail__title media-pearl-text">{detailItem.title}</h2>
                )}
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
              {statusButtons}
            </section>

            {panelFacts}
          </div>
        </div>
        {descriptionDialog}
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
      {torrentsDialog}
    </div>
  );
}
