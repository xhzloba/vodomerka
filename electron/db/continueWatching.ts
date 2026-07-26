import type { ContinueWatchingRecord, StoredMediaItem } from '../../contracts/ipc';
import { getDatabase } from './database';

export const CONTINUE_WATCHING_LIMIT = 20;

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

export function buildContinueWatchingId(
  mediaId: string | undefined | null,
  torrentId: string | undefined | null,
  filePath?: string | null,
): string {
  // Keep in sync with src/shared/domain/continueWatchingProgress.ts
  const base =
    typeof mediaId === 'string' && mediaId.length > 0
      ? mediaId
      : typeof torrentId === 'string' && torrentId.length > 0
        ? `torrent:${torrentId}`
        : '';
  if (!base) {
    throw new Error('continue watching id requires mediaId or torrentId');
  }
  if (typeof filePath === 'string' && filePath.length > 0) {
    return `${base}::${filePath}`;
  }
  return base;
}

function rowToRecord(row: {
  id: string;
  media_id: string;
  payload: string;
  torrent_id: string | null;
  file_path: string | null;
  position_seconds: number;
  duration_seconds: number | null;
  updated_at: number;
}): ContinueWatchingRecord | null {
  try {
    const item = parseStoredMediaItem(JSON.parse(row.payload));
    if (!item) {
      return null;
    }
    return {
      id: row.id,
      mediaId: row.media_id,
      item,
      torrentId: row.torrent_id ?? undefined,
      filePath: row.file_path ?? undefined,
      positionSeconds: Number(row.position_seconds) || 0,
      durationSeconds:
        row.duration_seconds == null ? undefined : Number(row.duration_seconds) || undefined,
      updatedAt: Number(row.updated_at) || 0,
    };
  } catch {
    return null;
  }
}

export function listContinueWatching(): ContinueWatchingRecord[] {
  const database = getDatabase();
  const rows = database
    .prepare(
      `
      SELECT id, media_id, payload, torrent_id, file_path,
             position_seconds, duration_seconds, updated_at
      FROM continue_watching
      ORDER BY updated_at DESC
      LIMIT @limit
    `,
    )
    .all({ limit: CONTINUE_WATCHING_LIMIT }) as Array<{
    id: string;
    media_id: string;
    payload: string;
    torrent_id: string | null;
    file_path: string | null;
    position_seconds: number;
    duration_seconds: number | null;
    updated_at: number;
  }>;

  return rows
    .map(rowToRecord)
    .filter((item): item is ContinueWatchingRecord => item !== null);
}

export type ContinueWatchingUpsertInput = {
  mediaId?: string | null;
  item: StoredMediaItem;
  torrentId?: string | null;
  filePath?: string | null;
  positionSeconds: number;
  durationSeconds?: number | null;
};

export function upsertContinueWatching(input: ContinueWatchingUpsertInput): ContinueWatchingRecord[] {
  const database = getDatabase();
  const mediaId =
    (typeof input.mediaId === 'string' && input.mediaId) ||
    input.item.id ||
    (input.torrentId ? `torrent:${input.torrentId}` : '');
  if (!mediaId) {
    return listContinueWatching();
  }

  const id = buildContinueWatchingId(mediaId, input.torrentId, input.filePath);
  const updatedAt = Math.floor(Date.now() / 1000);

  database
    .prepare(
      `
      INSERT INTO continue_watching (
        id, media_id, payload, torrent_id, file_path,
        position_seconds, duration_seconds, updated_at
      ) VALUES (
        @id, @mediaId, @payload, @torrentId, @filePath,
        @positionSeconds, @durationSeconds, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        media_id = excluded.media_id,
        payload = excluded.payload,
        torrent_id = excluded.torrent_id,
        file_path = excluded.file_path,
        position_seconds = excluded.position_seconds,
        duration_seconds = excluded.duration_seconds,
        updated_at = excluded.updated_at
    `,
    )
    .run({
      id,
      mediaId,
      payload: JSON.stringify(input.item),
      torrentId: input.torrentId ?? null,
      filePath: input.filePath ?? null,
      positionSeconds: Math.max(0, Number(input.positionSeconds) || 0),
      durationSeconds:
        input.durationSeconds == null || !Number.isFinite(input.durationSeconds)
          ? null
          : Math.max(0, Number(input.durationSeconds)),
      updatedAt,
    });

  // Keep only the latest episode/file per media (сериалы: последняя серия).
  database
    .prepare(
      `
      DELETE FROM continue_watching
      WHERE media_id = @mediaId AND id != @id
    `,
    )
    .run({ mediaId, id });

  const overflow = database
    .prepare(
      `
      SELECT id
      FROM continue_watching
      ORDER BY updated_at DESC
      LIMIT -1 OFFSET @limit
    `,
    )
    .all({ limit: CONTINUE_WATCHING_LIMIT }) as Array<{ id: string }>;

  if (overflow.length > 0) {
    const remove = database.prepare('DELETE FROM continue_watching WHERE id = ?');
    for (const row of overflow) {
      remove.run(row.id);
    }
  }

  return listContinueWatching();
}

export function removeContinueWatching(id: string): ContinueWatchingRecord[] {
  const database = getDatabase();
  database
    .prepare('DELETE FROM continue_watching WHERE id = ? OR media_id = ?')
    .run(id, id);
  return listContinueWatching();
}

/** Sweep resume entries pointing at torrents that no longer exist (deleted before this cleanup shipped). */
export function removeOrphanContinueWatchingTorrents(validTorrentIds: string[]): number {
  const database = getDatabase();
  const rows = database
    .prepare('SELECT id, torrent_id FROM continue_watching WHERE torrent_id IS NOT NULL')
    .all() as Array<{ id: string; torrent_id: string }>;

  const valid = new Set(validTorrentIds);
  const remove = database.prepare('DELETE FROM continue_watching WHERE id = ?');
  let removed = 0;
  for (const row of rows) {
    if (!valid.has(row.torrent_id)) {
      remove.run(row.id);
      removed += 1;
    }
  }
  return removed;
}

/** Deleted torrent → its resume entries are unplayable, drop them. Returns removed count. */
export function removeContinueWatchingByTorrentId(torrentId: string): number {
  if (!torrentId) {
    return 0;
  }
  const database = getDatabase();
  const result = database
    .prepare('DELETE FROM continue_watching WHERE torrent_id = ?')
    .run(torrentId);
  return Number(result.changes) || 0;
}

export function clearContinueWatching(): ContinueWatchingRecord[] {
  const database = getDatabase();
  database.prepare('DELETE FROM continue_watching').run();
  return [];
}
