import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { getMediaTypeLabel } from '@/shared/domain/media';
import { useFavorites } from '@/shared/domain/FavoritesContext';
import { useRecentlyViewed } from '@/shared/domain/RecentlyViewedContext';
import { useWatched } from '@/shared/domain/WatchedContext';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import { MediaCoverPlaceholder } from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';
import { useOverriddenMediaItem } from '@/shared/hooks/useOverriddenMediaItem';
import { useToast } from '@/shared/ui/Toast/ToastContext';
import { CloseIcon, EyeIcon, FavoritesIcon, InfoIcon, PlayIcon } from '@/shared/ui/icons';
import './MediaDetail.css';

interface MediaDetailProps {
  item: MediaItem;
  variant?: 'modal' | 'window';
  onClose: () => void;
  onPlay: (item: MediaItem) => void;
}

function buildMetaParts(item: MediaItem): string[] {
  return [
    item.rating != null ? `★ ${item.rating.toFixed(1)}` : null,
    item.year != null ? String(item.year) : null,
    getMediaTypeLabel(item.type),
    item.duration,
    item.country,
    item.age != null ? `${item.age}+` : null,
  ].filter((part): part is string => Boolean(part));
}

export function MediaDetail({ item, variant = 'modal', onClose, onPlay }: MediaDetailProps) {
  const detailItem = useOverriddenMediaItem(item);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isWatched, toggleWatched } = useWatched();
  const { trackView } = useRecentlyViewed();
  const { showToast } = useToast();
  const [isPendingFavorite, setIsPendingFavorite] = useState<boolean | null>(null);
  const [isPendingWatched, setIsPendingWatched] = useState<boolean | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const inFavorites = isPendingFavorite ?? isFavorite(detailItem.id);
  const inWatched = isPendingWatched ?? isWatched(detailItem.id);
  const isWindow = variant === 'window';
  const metaParts = buildMetaParts(detailItem);
  const typeLabel = getMediaTypeLabel(detailItem.type);

  useEffect(() => {
    setIsPendingFavorite(null);
    setIsPendingWatched(null);
    setDescriptionOpen(false);
  }, [detailItem.id]);

  useEffect(() => {
    if (!descriptionOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDescriptionOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [descriptionOpen]);

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
      try {
        await navigator.clipboard.writeText(detailItem.id);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = detailItem.id;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      showToast('ID скопирован в буфер обмена', { kind: 'copy', title: 'Скопировано' });
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

  const handleToggleWatched = useCallback(async () => {
    const nextState = !inWatched;
    setIsPendingWatched(nextState);

    try {
      const added = await toggleWatched(detailItem);
      setIsPendingWatched(added);
      showToast(
        added ? `«${detailItem.title}» в просмотренном` : `«${detailItem.title}» убрано из просмотренного`,
        {
          kind: added ? 'restore' : 'hide',
          title: added ? 'Просмотрено' : 'Убрано',
        },
      );
    } catch {
      setIsPendingWatched(null);
    }
  }, [detailItem, inWatched, showToast, toggleWatched]);

  const watchedButton = (
    <button
      type="button"
      className={`media-detail__watched-btn${
        inWatched ? ' media-detail__watched-btn--active' : ''
      }`}
      onClick={() => void handleToggleWatched()}
      aria-label={inWatched ? 'Убрать из просмотренного' : 'Отметить как просмотренное'}
      aria-pressed={inWatched}
      title={inWatched ? 'Просмотрено' : 'Отметить просмотренным'}
    >
      {inWatched ? <EyeIcon size={18} strokeWidth={2.1} /> : <EyeIcon size={18} />}
    </button>
  );

  const modalActions = (
    <div className="media-detail__actions">
      <button
        className="media-detail__btn media-detail__btn--primary"
        onClick={() => onPlay(detailItem)}
      >
        <PlayIcon size={18} />
        Смотреть
      </button>
      <button
        type="button"
        className={`media-detail__favorite-btn${
          inFavorites ? ' media-detail__favorite-btn--active' : ''
        }`}
        onClick={() => void handleToggleFavorite()}
        aria-label={inFavorites ? 'Убрать из избранного' : 'Добавить в избранное'}
        aria-pressed={inFavorites}
        title={inFavorites ? 'В избранном' : 'В избранное'}
      >
        <FavoritesIcon size={18} filled={inFavorites} />
      </button>
      {watchedButton}
      {detailItem.description ? (
        <button
          type="button"
          className="media-detail__btn media-detail__btn--secondary"
          onClick={() => setDescriptionOpen(true)}
        >
          <InfoIcon size={18} />
          Описание
        </button>
      ) : null}
      <button className="media-detail__btn media-detail__btn--secondary" onClick={onClose}>
        Закрыть
      </button>
    </div>
  );

  const windowActions = (
    <div className="media-detail__actions media-detail__actions--netflix">
      <button
        className="media-detail__btn media-detail__btn--primary media-detail__btn--play"
        onClick={() => onPlay(detailItem)}
      >
        <PlayIcon size={20} />
        Смотреть
      </button>
      <div className="media-detail__actions-side">
        <button
          type="button"
          className={`media-detail__favorite-btn${
            inFavorites ? ' media-detail__favorite-btn--active' : ''
          }`}
          onClick={() => void handleToggleFavorite()}
          aria-label={inFavorites ? 'Убрать из избранного' : 'Добавить в избранное'}
          aria-pressed={inFavorites}
          title={inFavorites ? 'В избранном' : 'В избранное'}
        >
          <FavoritesIcon size={18} filled={inFavorites} />
        </button>
        {watchedButton}
        {detailItem.description ? (
          <button
            type="button"
            className="media-detail__btn media-detail__btn--text"
            onClick={() => setDescriptionOpen(true)}
          >
            <InfoIcon size={18} />
            Описание
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      className={`media-detail${isWindow ? ' media-detail--window' : ''}`}
      onClick={isWindow ? undefined : onClose}
    >
      {!isWindow ? <div className="media-detail__backdrop" /> : null}
      <div className="media-detail__panel" onClick={(e) => e.stopPropagation()}>
        <div className="media-detail__hero" aria-hidden={!isWindow && showPoster}>
          {isHeroLoading ? <MediaCoverPlaceholder fill /> : null}
          {showHeroImage ? (
            <img
              key={src}
              className={[
                'media-detail__hero-image',
                'media-detail__hero-image--ready',
                !isWindow && showPoster ? '' : 'media-detail__hero-copy',
              ]
                .filter(Boolean)
                .join(' ')}
              src={src}
              alt=""
              loading={loading}
              referrerPolicy="no-referrer"
              onError={onError}
              onClick={
                !isWindow && showPoster ? undefined : (event) => void handleCopyId(event)
              }
            />
          ) : null}
          <div className="media-detail__hero-gradient" />
        </div>

        {!isWindow ? (
          <button className="media-detail__close" onClick={onClose} aria-label="Закрыть">
            <CloseIcon size={18} />
          </button>
        ) : null}

        <div className="media-detail__body">
          {isWindow ? (
            <div className="media-detail__overview">
              <p className="media-detail__eyebrow">{typeLabel}</p>

              {showLogo ? (
                <img
                  key={logoSrc}
                  className="media-detail__logo media-detail__logo--window"
                  src={logoSrc}
                  alt={detailItem.title}
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <h2 className="media-detail__title media-detail__title--window">{detailItem.title}</h2>
              )}

              {detailItem.subtitle && (
                <p className="media-detail__subtitle media-detail__subtitle--window">
                  {detailItem.subtitle}
                </p>
              )}

              <div className="media-detail__meta-row">
                {detailItem.rating != null && (
                  <span className="media-detail__match">★ {detailItem.rating.toFixed(1)}</span>
                )}
                {detailItem.year != null && (
                  <span className="media-detail__meta-item">{detailItem.year}</span>
                )}
                {detailItem.age != null && (
                  <span className="media-detail__age-badge">{detailItem.age}+</span>
                )}
                {detailItem.duration && (
                  <span className="media-detail__meta-item">{detailItem.duration}</span>
                )}
                <span className="media-detail__meta-item">{typeLabel}</span>
              </div>

              {detailItem.description && (
                <p className="media-detail__synopsis">{detailItem.description}</p>
              )}

              {windowActions}

              <div className="media-detail__facts">
                {detailItem.genres.length > 0 && (
                  <p className="media-detail__fact">
                    <span className="media-detail__fact-label">Жанры: </span>
                    <span className="media-detail__fact-value">{detailItem.genres.join(', ')}</span>
                  </p>
                )}
                {detailItem.director && (
                  <p className="media-detail__fact">
                    <span className="media-detail__fact-label">Режиссёр: </span>
                    <span className="media-detail__fact-value">{detailItem.director}</span>
                  </p>
                )}
                {detailItem.country && (
                  <p className="media-detail__fact">
                    <span className="media-detail__fact-label">Страна: </span>
                    <span className="media-detail__fact-value">{detailItem.country}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="media-detail__stack">
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
                    <h2 className="media-detail__title">{detailItem.title}</h2>
                  )}

                  {detailItem.subtitle && (
                    <p className="media-detail__subtitle">{detailItem.subtitle}</p>
                  )}

                  {metaParts.length > 0 && (
                    <p className="media-detail__meta">
                      {metaParts.map((part, index) => (
                        <span key={part}>
                          {index > 0 ? <span className="media-detail__meta-dot"> · </span> : null}
                          <span
                            className={
                              part.startsWith('★') ? 'media-detail__meta-rating' : undefined
                            }
                          >
                            {part}
                          </span>
                        </span>
                      ))}
                    </p>
                  )}

                  {detailItem.genres.length > 0 && (
                    <p className="media-detail__genres">{detailItem.genres.join(' · ')}</p>
                  )}
                </div>
              </div>

              {modalActions}
            </div>
          )}
        </div>

        {descriptionOpen && detailItem.description ? (
          <div className="media-detail__desc-modal" role="presentation">
            <button
              type="button"
              className="media-detail__desc-modal-backdrop"
              aria-label="Закрыть описание"
              onClick={() => setDescriptionOpen(false)}
            />
            <div
              className="media-detail__desc-modal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="media-detail-desc-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="media-detail__desc-modal-header">
                <h3 id="media-detail-desc-title" className="media-detail__desc-modal-title">
                  Описание
                </h3>
                <button
                  type="button"
                  className="media-detail__desc-modal-close"
                  onClick={() => setDescriptionOpen(false)}
                  aria-label="Закрыть"
                >
                  <CloseIcon size={16} />
                </button>
              </div>
              <p className="media-detail__desc-modal-text">{detailItem.description}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
