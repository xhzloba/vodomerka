import type { MediaItem } from '@/shared/domain/media';
import { hydrateMediaItems } from '@/shared/domain/overridesStore';

const STORAGE_KEY = 'tv-leonid-favorites';

function hydrateFavorites(items: MediaItem[]): MediaItem[] {
  return hydrateMediaItems(items);
}

function readLocalFavorites(): MediaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as MediaItem[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return hydrateFavorites(parsed);
  } catch {
    return [];
  }
}

function writeLocalFavorites(items: MediaItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function loadFavorites(): Promise<MediaItem[]> {
  if (window.electronAPI?.favorites) {
    return hydrateFavorites(await window.electronAPI.favorites.list());
  }

  return readLocalFavorites();
}

export async function addFavoriteItem(item: MediaItem): Promise<MediaItem[]> {
  if (window.electronAPI?.favorites) {
    const next = await window.electronAPI.favorites.add(item);
    writeLocalFavorites(next);
    return hydrateFavorites(next);
  }

  const current = readLocalFavorites();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)];
  writeLocalFavorites(next);
  return next;
}

export async function removeFavoriteItem(mediaId: string): Promise<MediaItem[]> {
  if (window.electronAPI?.favorites) {
    const next = await window.electronAPI.favorites.remove(mediaId);
    writeLocalFavorites(next);
    return hydrateFavorites(next);
  }

  const next = readLocalFavorites().filter((entry) => entry.id !== mediaId);
  writeLocalFavorites(next);
  return next;
}

export async function hasFavoriteItem(mediaId: string): Promise<boolean> {
  if (window.electronAPI?.favorites) {
    return window.electronAPI.favorites.has(mediaId);
  }

  return readLocalFavorites().some((entry) => entry.id === mediaId);
}

export async function clearAllFavorites(): Promise<MediaItem[]> {
  if (window.electronAPI?.favorites) {
    const next = await window.electronAPI.favorites.clear();
    writeLocalFavorites(next);
    return hydrateFavorites(next);
  }

  writeLocalFavorites([]);
  return [];
}
