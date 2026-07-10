import { getDatabase } from './database';
import type { StoredMediaItem } from './favorites';

export const RECENTLY_VIEWED_LIMIT = 15;

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

export function listRecentlyViewed(): StoredMediaItem[] {
  const database = getDatabase();
  const rows = database
    .prepare('SELECT payload FROM recently_viewed ORDER BY viewed_at DESC')
    .all() as Array<{ payload: string }>;

  return rows
    .map((row) => {
      try {
        return parseStoredMediaItem(JSON.parse(row.payload));
      } catch {
        return null;
      }
    })
    .filter((item): item is StoredMediaItem => item !== null)
    .slice(0, RECENTLY_VIEWED_LIMIT);
}

export function trackRecentlyViewed(item: StoredMediaItem): StoredMediaItem[] {
  const database = getDatabase();
  database
    .prepare(`
      INSERT INTO recently_viewed (media_id, payload, viewed_at)
      VALUES (@mediaId, @payload, strftime('%s', 'now'))
      ON CONFLICT(media_id) DO UPDATE SET
        payload = excluded.payload,
        viewed_at = excluded.viewed_at
    `)
    .run({
      mediaId: item.id,
      payload: JSON.stringify(item),
    });

  const overflow = database
    .prepare(`
      SELECT media_id
      FROM recently_viewed
      ORDER BY viewed_at DESC
      LIMIT -1 OFFSET @limit
    `)
    .all({ limit: RECENTLY_VIEWED_LIMIT }) as Array<{ media_id: string }>;

  if (overflow.length > 0) {
    const remove = database.prepare('DELETE FROM recently_viewed WHERE media_id = ?');
    for (const row of overflow) {
      remove.run(row.media_id);
    }
  }

  return listRecentlyViewed();
}

export function clearRecentlyViewed(): StoredMediaItem[] {
  const database = getDatabase();
  database.prepare('DELETE FROM recently_viewed').run();
  return [];
}
