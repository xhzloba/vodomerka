import type { MediaItem } from '@/shared/domain/media';
import type { MediaOverridesMap } from '../../../contracts/ipc';

export type { MediaOverride, MediaOverridesMap } from '../../../contracts/ipc';

export function applyMediaOverrides(item: MediaItem, overrides: MediaOverridesMap): MediaItem {
  const override = overrides[item.id];
  if (!override) {
    return item;
  }

  return {
    ...item,
    description: override.about ?? item.description,
    poster: override.poster ?? item.poster,
    backdrop: override.backdrop ?? item.backdrop,
    logo: override.logo ?? item.logo,
  };
}
