import { useEffect, useRef } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { MediaCard } from '../MediaCard/MediaCard';
import './MediaGrid.css';

interface MediaGridProps {
  items: MediaItem[];
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onMediaSelect: (item: MediaItem) => void;
}

export function MediaGrid({
  items,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onMediaSelect,
}: MediaGridProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '480px 0px', threshold: 0 },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore, items.length]);

  return (
    <div className="media-grid">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} onSelect={onMediaSelect} />
      ))}

      {isLoadingMore && <div className="media-grid__loader" aria-hidden="true" />}

      <div ref={sentinelRef} className="media-grid__sentinel" aria-hidden="true" />
    </div>
  );
}
