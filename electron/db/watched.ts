import type { StoredMediaItem, WatchStatus, WatchStatusRecord } from '../../contracts/ipc';
import { getDatabase } from './database';

export type { StoredMediaItem, WatchStatus, WatchStatusRecord } from '../../contracts/ipc';

const WATCH_STATUSES: readonly WatchStatus[] = ['watching', 'watched', 'postponed', 'dropped'];

function isWatchStatus(value: unknown): value is WatchStatus {
  return typeof value === 'string' && (WATCH_STATUSES as readonly string[]).includes(value);
}

function parseStoredMediaItem(value: unknown): StoredMediaItem | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const item = value as Partial<StoredMediaItem>;
  if (typeof item.id !== 'string' || !item.id || typeof item.title !== 'string' || !item.title) {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    year: item.year,
    type: item.type ?? 'movie',
    genres: Array.isArray(item.genres) ? item.genres.filter((genre) => typeof genre === 'string') : [],
    rating: item.rating,
    duration: item.duration,
    description: item.description,
    poster: item.poster ?? '',
    backdrop: item.backdrop ?? '',
    logo: item.logo,
    viewUrl: item.viewUrl ?? '',
    country: item.country,
    director: item.director,
    age: item.age,
  };
}

function ensureWatchStatusColumn(): void {
  const database = getDatabase();
  const columns = database.prepare('PRAGMA table_info(watched)').all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === 'status')) {
    return;
  }

  database.exec(`
    ALTER TABLE watched ADD COLUMN status TEXT NOT NULL DEFAULT 'watched';
  `);
}

function listWatchStatusRecords(): WatchStatusRecord[] {
  ensureWatchStatusColumn();
  const database = getDatabase();
  const rows = database
    .prepare('SELECT payload, status FROM watched ORDER BY watched_at DESC')
    .all() as Array<{ payload: string; status: string }>;

  return rows
    .map((row) => {
      try {
        const item = parseStoredMediaItem(JSON.parse(row.payload));
        if (!item) {
          return null;
        }
        const status = isWatchStatus(row.status) ? row.status : 'watched';
        return { item, status };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is WatchStatusRecord => entry !== null);
}

export function listWatchStatuses(): WatchStatusRecord[] {
  return listWatchStatusRecords();
}

/** @deprecated Prefer listWatchStatuses — kept for transitional callers expecting items only. */
export function listWatched(): StoredMediaItem[] {
  return listWatchStatusRecords()
    .filter((entry) => entry.status === 'watched')
    .map((entry) => entry.item);
}

export function setWatchStatus(item: StoredMediaItem, status: WatchStatus): WatchStatusRecord[] {
  if (!isWatchStatus(status)) {
    throw new Error(`Invalid watch status: ${String(status)}`);
  }

  ensureWatchStatusColumn();
  const database = getDatabase();
  database
    .prepare(`
      INSERT INTO watched (media_id, payload, watched_at, status)
      VALUES (@mediaId, @payload, strftime('%s', 'now'), @status)
      ON CONFLICT(media_id) DO UPDATE SET
        payload = excluded.payload,
        watched_at = excluded.watched_at,
        status = excluded.status
    `)
    .run({
      mediaId: item.id,
      payload: JSON.stringify(item),
      status,
    });

  return listWatchStatusRecords();
}

/** Legacy: mark as watched. */
export function addWatched(item: StoredMediaItem): StoredMediaItem[] {
  return setWatchStatus(item, 'watched')
    .filter((entry) => entry.status === 'watched')
    .map((entry) => entry.item);
}

export function removeWatchStatus(mediaId: string): WatchStatusRecord[] {
  ensureWatchStatusColumn();
  const database = getDatabase();
  database.prepare('DELETE FROM watched WHERE media_id = ?').run(mediaId);
  return listWatchStatusRecords();
}

export function removeWatched(mediaId: string): StoredMediaItem[] {
  return removeWatchStatus(mediaId)
    .filter((entry) => entry.status === 'watched')
    .map((entry) => entry.item);
}

export function getWatchStatus(mediaId: string): WatchStatus | null {
  ensureWatchStatusColumn();
  const database = getDatabase();
  const row = database.prepare('SELECT status FROM watched WHERE media_id = ?').get(mediaId) as
    | { status: string }
    | undefined;

  if (!row) {
    return null;
  }

  return isWatchStatus(row.status) ? row.status : 'watched';
}

export function hasWatched(mediaId: string): boolean {
  return getWatchStatus(mediaId) === 'watched';
}

export function clearWatchStatuses(status?: WatchStatus): WatchStatusRecord[] {
  ensureWatchStatusColumn();
  const database = getDatabase();

  if (status) {
    if (!isWatchStatus(status)) {
      throw new Error(`Invalid watch status: ${String(status)}`);
    }
    database.prepare('DELETE FROM watched WHERE status = ?').run(status);
  } else {
    database.prepare('DELETE FROM watched').run();
  }

  return listWatchStatusRecords();
}

export function clearAllWatched(): StoredMediaItem[] {
  clearWatchStatuses();
  return [];
}
