import type {
  ContinueWatchingRecord,
  ContinueWatchingUpsertPayload,
  MediaPlaybackSession,
  StoredMediaItem,
  TorrentDownloadRecord,
} from '../../../contracts/ipc';
import {
  formatEpisodeLabel,
  hasMultipleEpisodes,
  parseEpisodeFromName,
} from '@/shared/domain/torrentEpisodes';

export const CONTINUE_MIN_SECONDS = 30;
export const CONTINUE_MIN_RATIO = 0.02;
export const CONTINUE_COMPLETE_RATIO = 0.9;
export const CONTINUE_UPSERT_THROTTLE_MS = 8_000;

export function buildContinueWatchingId(
  mediaId: string | undefined | null,
  torrentId: string | undefined | null,
  filePath?: string | null,
): string {
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

export function shouldPersistContinueProgress(
  positionSeconds: number,
  durationSeconds: number,
): boolean {
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return false;
  }
  if (positionSeconds < CONTINUE_MIN_SECONDS) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return false;
    }
    return positionSeconds / durationSeconds >= CONTINUE_MIN_RATIO;
  }
  return true;
}

export function isContinueProgressComplete(
  positionSeconds: number,
  durationSeconds: number,
): boolean {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return false;
  }
  return positionSeconds / durationSeconds >= CONTINUE_COMPLETE_RATIO;
}

function fileNameFromPath(filePath?: string | null): string {
  if (!filePath) {
    return '';
  }
  return filePath.split(/[/\\]/).pop() || filePath;
}

export function getContinueEpisodeInfo(filePath?: string | null): {
  season: number | null;
  episode: number | null;
} {
  return parseEpisodeFromName(fileNameFromPath(filePath));
}

export function formatContinueEpisodeBadge(filePath?: string | null): string | null {
  const fileName = fileNameFromPath(filePath);
  if (!fileName) {
    return null;
  }
  const { season, episode } = parseEpisodeFromName(fileName);
  if (season == null && episode == null) {
    return null;
  }
  const parts: string[] = [];
  if (season != null) {
    parts.push(`Сезон ${season}`);
  }
  if (episode != null) {
    parts.push(formatEpisodeLabel(season, episode, fileName));
  }
  return parts.join(' · ');
}

export function isContinueSerialRecord(record: ContinueWatchingRecord): boolean {
  if (record.item.type === 'serial') {
    return true;
  }
  const { season, episode } = getContinueEpisodeInfo(record.filePath);
  return season != null || episode != null;
}

/** Сериал: SxxExx в пути, type=serial, или несколько видеофайлов в торренте. */
export function isContinueSerialPlayback(
  session: Pick<MediaPlaybackSession, 'sourcePath' | 'filePath'>,
  torrent?: TorrentDownloadRecord | null,
): boolean {
  const filePath = session.sourcePath || session.filePath;
  const { season, episode } = getContinueEpisodeInfo(filePath);
  if (season != null || episode != null) {
    return true;
  }
  return Boolean(torrent && hasMultipleEpisodes(torrent.files));
}

export function buildContinueMediaItem(
  session: MediaPlaybackSession,
  torrent?: TorrentDownloadRecord | null,
): StoredMediaItem {
  const mediaId =
    session.mediaId ||
    torrent?.mediaId ||
    (session.torrentId ? `torrent:${session.torrentId}` : 'unknown');
  const title = torrent?.mediaTitle || torrent?.title || session.title || 'Видео';
  const poster = session.posterUrl || torrent?.posterUrl || '';
  const isSerial = isContinueSerialPlayback(session, torrent);

  return {
    id: mediaId,
    title,
    type: isSerial ? 'serial' : 'movie',
    genres: [],
    poster,
    backdrop: poster,
    viewUrl: '',
  };
}

export function buildContinueUpsertPayload(
  session: MediaPlaybackSession,
  positionSeconds: number,
  durationSeconds: number,
  torrent?: TorrentDownloadRecord | null,
): ContinueWatchingUpsertPayload {
  const item = buildContinueMediaItem(session, torrent);
  const filePath = session.sourcePath || session.filePath || undefined;

  return {
    mediaId: item.id,
    item,
    torrentId: session.torrentId,
    filePath,
    positionSeconds,
    durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
  };
}

export function continueWatchingIdForSession(
  session: MediaPlaybackSession,
  torrent?: TorrentDownloadRecord | null,
): string {
  const mediaId = session.mediaId || torrent?.mediaId;
  const filePath = session.sourcePath || session.filePath;
  try {
    return buildContinueWatchingId(mediaId, session.torrentId, filePath);
  } catch {
    return `torrent:${session.torrentId}`;
  }
}
