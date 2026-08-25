import { useRef } from 'react';
import type { MediaCastMember } from '@/shared/domain/media';
import { useHorizontalDragScroll } from '@/shared/hooks/useHorizontalDragScroll';
import { useMediaImage } from '@/shared/hooks/useMediaImage';
import { MediaCoverPlaceholder } from '@/shared/ui/MediaCoverPlaceholder/MediaCoverPlaceholder';

function CastCard({ member }: { member: MediaCastMember }) {
  const { src, failed, ready, loading, onError } = useMediaImage({
    primaryUrl: member.poster ?? '',
    eager: false,
  });
  const showImage = Boolean(src) && ready && !failed;

  return (
    <article className="media-detail__cast-card">
      <div className="media-detail__cast-avatar">
        {!showImage ? (
          <MediaCoverPlaceholder
            className="media-detail__cast-placeholder"
            fill
            animate={false}
          />
        ) : null}
        {src && !failed ? (
          <img
            className={`media-detail__cast-image${showImage ? ' media-detail__cast-image--ready' : ''}`}
            src={src}
            alt=""
            loading={loading}
            referrerPolicy="no-referrer"
            onError={onError}
          />
        ) : null}
      </div>
      <p className="media-detail__cast-name" title={member.name}>
        {member.name}
      </p>
    </article>
  );
}

export function DetailCastStrip({ cast }: { cast: MediaCastMember[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalDragScroll(scrollRef, cast.length > 2);

  if (cast.length === 0) {
    return null;
  }

  return (
    <section className="media-detail__cast-row" aria-label="Актёры">
      <div className="media-detail__cast-head">
        <h2 className="media-detail__cast-title">В ролях</h2>
        <span className="media-detail__cast-count">{cast.length}</span>
      </div>
      <div
        ref={scrollRef}
        className="media-detail__cast-scroll"
      >
        {cast.map((member) => (
          <div key={member.id} className="media-detail__cast-item">
            <CastCard member={member} />
          </div>
        ))}
      </div>
    </section>
  );
}
