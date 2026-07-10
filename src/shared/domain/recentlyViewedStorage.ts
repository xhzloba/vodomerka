import type { MediaItem } from '@/shared/domain/media';
import { hydrateMediaItems } from '@/shared/domain/overridesStore';

const STORAGE_KEY = 'tv-leonid-recently-viewed';
export const RECENTLY_VIEWED_LIMIT = 15;

function hydrateRecentlyViewed(items: MediaItem[]): MediaItem[] {
  return hydrateMediaItems(items);
}

function readLocalRecentlyViewed(): MediaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as MediaItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return hydrateRecentlyViewed(parsed).slice(0, RECENTLY_VIEWED_LIMIT);
  } catch {
    return [];
  }
}

function writeLocalRecentlyViewed(items: MediaItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function trimLocalRecentlyViewed(items: MediaItem[]): MediaItem[] {
  return items.slice(0, RECENTLY_VIEWED_LIMIT);
}

export async function loadRecentlyViewed(): Promise<MediaItem[]> {
  if (window.electronAPI?.recentlyViewed) {
    return hydrateRecentlyViewed(await window.electronAPI.recentlyViewed.list());
  }

  return readLocalRecentlyViewed();
}

export async function trackRecentlyViewedItem(item: MediaItem): Promise<MediaItem[]> {
  if (window.electronAPI?.recentlyViewed) {
    const next = await window.electronAPI.recentlyViewed.track(item);
    writeLocalRecentlyViewed(next);
    return hydrateRecentlyViewed(next);
  }

  const current = readLocalRecentlyViewed();
  const next = trimLocalRecentlyViewed([
    item,
    ...current.filter((entry) => entry.id !== item.id),
  ]);
  writeLocalRecentlyViewed(next);
  return next;
}

export async function clearRecentlyViewed(): Promise<MediaItem[]> {
  if (window.electronAPI?.recentlyViewed) {
    const next = await window.electronAPI.recentlyViewed.clear();
    writeLocalRecentlyViewed(next);
    return hydrateRecentlyViewed(next);
  }

  writeLocalRecentlyViewed([]);
  return [];
}
