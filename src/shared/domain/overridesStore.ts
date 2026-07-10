import { httpGet } from '@/shared/api/httpClient';
import { MEDIA_OVERRIDES_JSON_URL } from '@/shared/config/overrides';
import type { MediaItem } from '@/shared/domain/media';
import { applyMediaOverrides, type MediaOverridesMap } from '@/shared/domain/overrides';

let overrides: MediaOverridesMap = {};
let loadPromise: Promise<MediaOverridesMap> | null = null;

async function fetchOverrides(): Promise<MediaOverridesMap> {
  if (window.electronAPI?.overrides?.get) {
    return window.electronAPI.overrides.get();
  }

  return httpGet<MediaOverridesMap>(MEDIA_OVERRIDES_JSON_URL);
}

export async function ensureMediaOverridesLoaded(force = false): Promise<MediaOverridesMap> {
  if (!force && loadPromise) {
    return loadPromise;
  }

  loadPromise = fetchOverrides()
    .then((data) => {
      overrides = data ?? {};
      return overrides;
    })
    .catch((error) => {
      loadPromise = null;
      if (import.meta.env.DEV) {
        console.warn('[overrides] failed to load', error);
      }
      overrides = {};
      return overrides;
    });

  return loadPromise;
}

export function getMediaOverrides(): MediaOverridesMap {
  return overrides;
}

export function hydrateMediaItem(item: MediaItem): MediaItem {
  return applyMediaOverrides(item, overrides);
}

export function hydrateMediaItems(items: MediaItem[]): MediaItem[] {
  return items.map(hydrateMediaItem);
}

export function invalidateMediaOverridesCache(): void {
  loadPromise = null;
  overrides = {};
  void window.electronAPI?.overrides?.invalidate?.();
}
