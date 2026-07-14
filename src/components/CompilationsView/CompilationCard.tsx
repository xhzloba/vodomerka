import { useRef, useState } from 'react';
import type { VokinoCompilationItem } from '@/shared/api/vokino/compilations';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import { useAppSettings } from '@/shared/settings/AppSettingsContext';
import { MediaCoverPlaceholder } from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';
import { PlayOverlayIcon } from '@/shared/ui/icons';
import '../MediaCard/MediaCard.css';
import './CompilationCard.css';

interface CompilationCardProps {
  item: VokinoCompilationItem;
  onSelect: (item: VokinoCompilationItem) => void;
}

export function CompilationCard({ item, onSelect }: CompilationCardProps) {
  const { settings } = useAppSettings();
  const cardRef = useRef<HTMLElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const posterUrl = item.details.poster ?? '';
  const hasPoster = Boolean(posterUrl);
  const { src, failed, ready, loading, onError } = useMediaImage({
    primaryUrl: posterUrl,
    rootRef: cardRef,
  });

  const showImage = hasPoster && !failed && ready;
  const isLoading = hasPoster && !failed && !ready;
  const isEmpty = !hasPoster || failed;

  return (
    <article
      ref={cardRef}
      className={`media-card compilation-card${isFocused ? ' media-card--focused' : ''}${isEmpty && !isLoading ? ' media-card--empty' : ''}`}
      onClick={() => onSelect(item)}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item);
        }
      }}
      aria-label={item.details.name}
    >
      <div className="media-card__snake">
        <div className="media-card__snake-ring" aria-hidden="true">
          <div className="media-card__snake-beam media-card__snake-beam--trail" />
          <div className="media-card__snake-beam media-card__snake-beam--core" />
        </div>
        <div
          className={`media-card__poster-wrap${isEmpty && !isLoading ? ' media-card__poster-wrap--empty' : ''}${isLoading ? ' media-card__poster-wrap--loading' : ''}`}
        >
          {isLoading || isEmpty ? (
            <MediaCoverPlaceholder
              className="media-card__cover-placeholder"
              fill
              variant="poster"
              animate={isLoading}
            />
          ) : null}
          {showImage ? (
            <img
              key={src}
              src={src}
              alt=""
              className="media-card__poster media-card__poster--ready"
              loading={loading}
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              onDragStart={(event) => event.preventDefault()}
              onError={onError}
            />
          ) : null}
          <div className="media-card__dim" aria-hidden="true" />
          <div className="media-card__play">
            <PlayOverlayIcon size={54} />
          </div>
        </div>
      </div>

      {settings.cardShowInfo ? (
        <div className="media-card__info">
          <h3 className="media-card__title">{item.details.name}</h3>
        </div>
      ) : null}
    </article>
  );
}
