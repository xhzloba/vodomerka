import type { MediaItem } from '@/shared/domain/media';
import { hydrateMediaItems } from '@/shared/domain/overridesStore';
import { isWatchStatus, type WatchStatus } from '@/shared/domain/watchStatus';

export interface WatchStatusEntry {
  item: MediaItem;
  status: WatchStatus;
}

const STORAGE_KEY = 'tv-leonid-watch-statuses';

function hydrateEntries(entries: WatchStatusEntry[]): WatchStatusEntry[] {
  const items = hydrateMediaItems(entries.map((entry) => entry.item));
  return entries.map((entry, index) => ({
    item: items[index] ?? entry.item,
    status: entry.status,
  }));
}

function readLocalEntries(): WatchStatusEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Migrate legacy watched-only localStorage if present.
      const legacy = localStorage.getItem('tv-leonid-watched');
      if (!legacy) {
        return [];
      }
      const parsed = JSON.parse(legacy) as MediaItem[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      const migrated = parsed
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => ({ item, status: 'watched' as const }));
      writeLocalEntries(migrated);
      localStorage.removeItem('tv-leonid-watched');
      return hydrateEntries(migrated);
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries: WatchStatusEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const record = row as { item?: MediaItem; status?: unknown };
      if (!record.item || typeof record.item.id !== 'string') {
        continue;
      }
      if (!isWatchStatus(record.status)) {
        continue;
      }
      entries.push({ item: record.item, status: record.status });
    }

    return hydrateEntries(entries);
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: WatchStatusEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function fromApiRecords(
  records: Array<{ item: MediaItem; status: WatchStatus }>,
): WatchStatusEntry[] {
  return hydrateEntries(records.map((record) => ({ item: record.item, status: record.status })));
}

export async function loadWatchStatuses(): Promise<WatchStatusEntry[]> {
  if (window.electronAPI?.watched) {
    return fromApiRecords(await window.electronAPI.watched.list());
  }

  return readLocalEntries();
}

export async function setWatchStatusItem(
  item: MediaItem,
  status: WatchStatus,
): Promise<WatchStatusEntry[]> {
  if (window.electronAPI?.watched) {
    const next = await window.electronAPI.watched.setStatus(item, status);
    writeLocalEntries(next);
    return fromApiRecords(next);
  }

  const current = readLocalEntries().filter((entry) => entry.item.id !== item.id);
  const next = [{ item, status }, ...current];
  writeLocalEntries(next);
  return next;
}

export async function removeWatchStatusItem(mediaId: string): Promise<WatchStatusEntry[]> {
  if (window.electronAPI?.watched) {
    const next = await window.electronAPI.watched.remove(mediaId);
    writeLocalEntries(next);
    return fromApiRecords(next);
  }

  const next = readLocalEntries().filter((entry) => entry.item.id !== mediaId);
  writeLocalEntries(next);
  return next;
}

export async function clearWatchStatusBucket(status?: WatchStatus): Promise<WatchStatusEntry[]> {
  if (window.electronAPI?.watched) {
    const next = await window.electronAPI.watched.clear(status);
    writeLocalEntries(next);
    return fromApiRecords(next);
  }

  if (!status) {
    writeLocalEntries([]);
    return [];
  }

  const next = readLocalEntries().filter((entry) => entry.status !== status);
  writeLocalEntries(next);
  return next;
}
