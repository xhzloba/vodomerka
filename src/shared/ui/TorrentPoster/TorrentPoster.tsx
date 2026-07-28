import { useMediaImage } from '@/shared/hooks/useMediaImage';

interface TorrentPosterProps {
  posterUrl?: string;
  title: string;
  className?: string;
  eager?: boolean;
}

/** Same image pipeline as catalog cards — Vokino proxy/uploads need IPC. */
export function TorrentPoster({
  posterUrl = '',
  title,
  className,
  eager = true,
}: TorrentPosterProps) {
  const { src, failed, loading, onError } = useMediaImage({
    primaryUrl: posterUrl,
    eager,
  });

  // Letter only when there is nothing to load / load died.
  // Do NOT swap to letter while IPC queue is still fetching (looks like «missing poster»).
  const showLetter = !posterUrl || failed;
  const showImage = Boolean(src) && !failed;

  return (
    <div className={className} aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onError}
        />
      ) : showLetter ? (
        <span>{(title || '?').slice(0, 1)}</span>
      ) : null}
    </div>
  );
}
