import type { StoredMediaItem } from '../../contracts/ipc';
import { getDatabase } from './database';

export type { StoredMediaItem } from '../../contracts/ipc';

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

export function listWatched(): StoredMediaItem[] {
  const database = getDatabase();
  const rows = database
    .prepare('SELECT payload FROM watched ORDER BY watched_at DESC')
    .all() as Array<{ payload: string }>;

  return rows
    .map((row) => {
      try {
        return parseStoredMediaItem(JSON.parse(row.payload));
      } catch {
        return null;
      }
    })
    .filter((item): item is StoredMediaItem => item !== null);
}

export function addWatched(item: StoredMediaItem): StoredMediaItem[] {
  const database = getDatabase();
  database
    .prepare(`
      INSERT INTO watched (media_id, payload, watched_at)
      VALUES (@mediaId, @payload, strftime('%s', 'now'))
      ON CONFLICT(media_id) DO UPDATE SET
        payload = excluded.payload,
        watched_at = excluded.watched_at
    `)
    .run({
      mediaId: item.id,
      payload: JSON.stringify(item),
    });

  return listWatched();
}

export function removeWatched(mediaId: string): StoredMediaItem[] {
  const database = getDatabase();
  database.prepare('DELETE FROM watched WHERE media_id = ?').run(mediaId);
  return listWatched();
}

export function hasWatched(mediaId: string): boolean {
  const database = getDatabase();
  const row = database.prepare('SELECT media_id FROM watched WHERE media_id = ?').get(mediaId) as
    | { media_id: string }
    | undefined;

  return Boolean(row?.media_id);
}

export function clearAllWatched(): StoredMediaItem[] {
  const database = getDatabase();
  database.prepare('DELETE FROM watched').run();
  return [];
}
