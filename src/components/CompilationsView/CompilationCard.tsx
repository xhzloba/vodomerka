import { useRef } from 'react';
import type { VokinoCompilationItem } from '@/shared/api/vokino/compilations';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import { MediaCoverPlaceholder } from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';
import './CompilationCard.css';

interface CompilationCardProps {
  item: VokinoCompilationItem;
  onSelect: (item: VokinoCompilationItem) => void;
}

export function CompilationCard({ item, onSelect }: CompilationCardProps) {
  const cardRef = useRef<HTMLElement>(null);
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
    <article ref={cardRef} className="compilation-card">
      <button
        type="button"
        className="compilation-card__button"
        onClick={() => onSelect(item)}
        aria-label={item.details.name}
      >
        <div
          className={`compilation-card__poster-wrap${isLoading ? ' compilation-card__poster-wrap--loading' : ''}`}
        >
          {isLoading || isEmpty ? (
            <MediaCoverPlaceholder
              className="compilation-card__placeholder"
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
              className="compilation-card__poster compilation-card__poster--ready"
              loading={loading}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={onError}
            />
          ) : null}
        </div>
        <h2 className="compilation-card__title">{item.details.name}</h2>
      </button>
    </article>
  );
}
