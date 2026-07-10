import { useEffect, useState } from 'react';
import type { MediaItem } from '@/shared/domain/media';
import { applyMediaOverrides } from '@/shared/domain/overrides';
import { ensureMediaOverridesLoaded, getMediaOverrides } from '@/shared/domain/overridesStore';

export function useOverriddenMediaItem(item: MediaItem): MediaItem {
  const [resolved, setResolved] = useState(() => applyMediaOverrides(item, getMediaOverrides()));

  useEffect(() => {
    setResolved(applyMediaOverrides(item, getMediaOverrides()));

    let cancelled = false;

    void ensureMediaOverridesLoaded().then(() => {
      if (!cancelled) {
        setResolved(applyMediaOverrides(item, getMediaOverrides()));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [item]);

  return resolved;
}
