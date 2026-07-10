import type { MediaItem } from '@/shared/domain/media';
import { hydrateMediaItems } from '@/shared/domain/overridesStore';

const STORAGE_KEY = 'tv-leonid-watched';

function hydrateWatched(items: MediaItem[]): MediaItem[] {
  return hydrateMediaItems(items);
}

function readLocalWatched(): MediaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as MediaItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return hydrateWatched(parsed);
  } catch {
    return [];
  }
}

function writeLocalWatched(items: MediaItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function loadWatched(): Promise<MediaItem[]> {
  if (window.electronAPI?.watched) {
    return hydrateWatched(await window.electronAPI.watched.list());
  }

  return readLocalWatched();
}

export async function addWatchedItem(item: MediaItem): Promise<MediaItem[]> {
  if (window.electronAPI?.watched) {
    const next = await window.electronAPI.watched.add(item);
    writeLocalWatched(next);
    return hydrateWatched(next);
  }

  const current = readLocalWatched();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)];
  writeLocalWatched(next);
  return next;
}

export async function removeWatchedItem(mediaId: string): Promise<MediaItem[]> {
  if (window.electronAPI?.watched) {
    const next = await window.electronAPI.watched.remove(mediaId);
    writeLocalWatched(next);
    return hydrateWatched(next);
  }

  const next = readLocalWatched().filter((entry) => entry.id !== mediaId);
  writeLocalWatched(next);
  return next;
}

export async function hasWatchedItem(mediaId: string): Promise<boolean> {
  if (window.electronAPI?.watched) {
    return window.electronAPI.watched.has(mediaId);
  }

  return readLocalWatched().some((entry) => entry.id === mediaId);
}

export async function clearAllWatched(): Promise<MediaItem[]> {
  if (window.electronAPI?.watched) {
    const next = await window.electronAPI.watched.clear();
    writeLocalWatched(next);
    return hydrateWatched(next);
  }

  writeLocalWatched([]);
  return [];
}
