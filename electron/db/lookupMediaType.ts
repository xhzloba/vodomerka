import { getDatabase } from './database';

const KNOWN_MEDIA_TYPES = new Set([
  'movie',
  'serial',
  'multfilm',
  'multserial',
  'anime',
]);

export function normalizeMediaType(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const type = value.trim().toLowerCase();
  return KNOWN_MEDIA_TYPES.has(type) ? type : undefined;
}

/** Resolve catalog type for a mediaId from local library tables. */
export function lookupStoredMediaType(mediaId: string): string | undefined {
  const id = mediaId.trim();
  if (!id) {
    return undefined;
  }

  try {
    const database = getDatabase();
    const row = database
      .prepare(
        `
        SELECT payload FROM favorites WHERE media_id = ? AND payload IS NOT NULL
        UNION ALL
        SELECT payload FROM recently_viewed WHERE media_id = ? AND payload IS NOT NULL
        UNION ALL
        SELECT payload FROM watched WHERE media_id = ? AND payload IS NOT NULL
        UNION ALL
        SELECT payload FROM continue_watching WHERE media_id = ? AND payload IS NOT NULL
        LIMIT 1
      `,
      )
      .get(id, id, id, id) as { payload: string } | undefined;

    if (!row?.payload) {
      return undefined;
    }

    const parsed = JSON.parse(row.payload) as { type?: unknown };
    return normalizeMediaType(parsed.type);
  } catch {
    return undefined;
  }
}
