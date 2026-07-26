import type { ContinueWatchingRecord, ContinueWatchingUpsertPayload } from '../../../contracts/ipc';
import { hydrateMediaItems } from '@/shared/domain/overridesStore';
import type { MediaItem } from '@/shared/domain/media';

const STORAGE_KEY = 'tv-leonid-continue-watching';
export const CONTINUE_WATCHING_LIMIT = 20;

function hydrateRecords(records: ContinueWatchingRecord[]): ContinueWatchingRecord[] {
  const items = hydrateMediaItems(records.map((record) => record.item));
  return records.map((record, index) => ({
    ...record,
    item: items[index] ?? record.item,
  }));
}

function readLocalContinueWatching(): ContinueWatchingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ContinueWatchingRecord[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return hydrateRecords(parsed).slice(0, CONTINUE_WATCHING_LIMIT);
  } catch {
    return [];
  }
}

function writeLocalContinueWatching(records: ContinueWatchingRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function continueRecordToMediaItem(record: ContinueWatchingRecord): MediaItem {
  return record.item;
}

export async function loadContinueWatching(): Promise<ContinueWatchingRecord[]> {
  if (window.electronAPI?.continueWatching) {
    return hydrateRecords(await window.electronAPI.continueWatching.list());
  }
  return readLocalContinueWatching();
}

export async function upsertContinueWatchingItem(
  payload: ContinueWatchingUpsertPayload,
): Promise<ContinueWatchingRecord[]> {
  if (window.electronAPI?.continueWatching) {
    const next = await window.electronAPI.continueWatching.upsert(payload);
    writeLocalContinueWatching(next);
    return hydrateRecords(next);
  }

  const mediaId = payload.mediaId || payload.item.id;
  const id =
    payload.filePath && payload.filePath.length > 0
      ? `${mediaId}::${payload.filePath}`
      : mediaId;
  const now = Math.floor(Date.now() / 1000);
  const nextRecord: ContinueWatchingRecord = {
    id,
    mediaId,
    item: payload.item,
    torrentId: payload.torrentId,
    filePath: payload.filePath,
    positionSeconds: payload.positionSeconds,
    durationSeconds: payload.durationSeconds,
    updatedAt: now,
  };
  const current = readLocalContinueWatching().filter(
    (entry) => entry.mediaId !== mediaId && entry.id !== id,
  );
  const next = hydrateRecords([nextRecord, ...current]).slice(0, CONTINUE_WATCHING_LIMIT);
  writeLocalContinueWatching(next);
  return next;
}

export async function removeContinueWatchingItem(id: string): Promise<ContinueWatchingRecord[]> {
  if (window.electronAPI?.continueWatching) {
    const next = await window.electronAPI.continueWatching.remove(id);
    writeLocalContinueWatching(next);
    return hydrateRecords(next);
  }

  const next = readLocalContinueWatching().filter((entry) => entry.id !== id);
  writeLocalContinueWatching(next);
  return next;
}

export async function clearContinueWatchingItems(): Promise<ContinueWatchingRecord[]> {
  if (window.electronAPI?.continueWatching) {
    const next = await window.electronAPI.continueWatching.clear();
    writeLocalContinueWatching(next);
    return hydrateRecords(next);
  }

  writeLocalContinueWatching([]);
  return [];
}
