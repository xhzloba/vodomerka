import { randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import type { MediaPreparePlaybackResult } from '../../contracts/ipc';
import {
  buildWebTorrentFileUrl,
  ensureWebTorrentHttpServer,
  getActiveWebTorrent,
  getTorrentPlaybackSource,
  prioritizeTorrentPlayback,
} from '../torrents/manager';
import {
  canDirectPlay,
  getExistingPlayableCache,
  startBackgroundPlayableCache,
} from './remux';
import {
  buildMediaUrl,
  ensureMediaServer,
  registerFileRemuxToken,
  registerLiveRemuxToken,
  registerMediaToken,
} from './server';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function prepareTorrentPlayback(torrentId: string): Promise<MediaPreparePlaybackResult> {
  const source = getTorrentPlaybackSource(torrentId);
  if (!source.ok) {
    return source;
  }

  const activeFile = prioritizeTorrentPlayback(torrentId);
  const activeTorrent = getActiveWebTorrent(torrentId);

  try {
    // Finished download
    if (source.done) {
      if (!(await fileExists(source.filePath))) {
        return { ok: false, error: 'Файл не найден на диске' };
      }

      const { port } = await ensureMediaServer();

      // Direct containers (mp4/webm…)
      if (canDirectPlay(source.filePath)) {
        const token = randomUUID();
        registerMediaToken(token, source.filePath);
        return {
          ok: true,
          session: {
            torrentId,
            title: source.title,
            posterUrl: source.posterUrl,
            url: buildMediaUrl(token, port),
            filePath: source.filePath,
            sourcePath: source.filePath,
            remuxed: false,
            live: false,
            seekable: true,
          },
        };
      }

      // Seekable AAC cache already built
      const cached = await getExistingPlayableCache(source.filePath);
      if (cached) {
        const token = randomUUID();
        registerMediaToken(token, cached);
        return {
          ok: true,
          session: {
            torrentId,
            title: source.title,
            posterUrl: source.posterUrl,
            url: buildMediaUrl(token, port),
            filePath: cached,
            sourcePath: source.filePath,
            remuxed: true,
            live: false,
            seekable: true,
          },
        };
      }

      // Instant play: stream remux from disk (no waiting for full 2GB AAC convert)
      startBackgroundPlayableCache(source.filePath);
      const token = randomUUID();
      registerFileRemuxToken(token, source.filePath, source.fileName);
      return {
        ok: true,
        session: {
          torrentId,
          title: source.title,
          posterUrl: source.posterUrl,
          url: buildMediaUrl(token, port),
          filePath: source.filePath,
          sourcePath: source.filePath,
          remuxed: true,
          live: true,
          seekable: false,
        },
      };
    }

    // Still downloading + Chromium-native container → WebTorrent HTTP
    if (activeTorrent && activeFile && canDirectPlay(activeFile.name)) {
      const { port, pathname } = await ensureWebTorrentHttpServer();
      return {
        ok: true,
        session: {
          torrentId,
          title: source.title,
          posterUrl: source.posterUrl,
          url: buildWebTorrentFileUrl(port, pathname, activeTorrent.infoHash, activeFile.path),
          filePath: source.filePath,
          sourcePath: source.filePath,
          remuxed: false,
          live: true,
          seekable: true,
        },
      };
    }

    // Still downloading + mkv: prefer remux from disk if file already exists (more reliable than pipe)
    if (await fileExists(source.filePath) && !canDirectPlay(source.filePath)) {
      const { port } = await ensureMediaServer();
      prioritizeTorrentPlayback(torrentId);
      const token = randomUUID();
      registerFileRemuxToken(token, source.filePath, source.fileName);
      return {
        ok: true,
        session: {
          torrentId,
          title: source.title,
          posterUrl: source.posterUrl,
          url: buildMediaUrl(token, port),
          filePath: source.filePath,
          sourcePath: source.filePath,
          remuxed: true,
          live: true,
          seekable: false,
        },
      };
    }

    // Fallback: live remux from WebTorrent stream
    if (activeTorrent && activeFile) {
      const { port } = await ensureMediaServer();
      const token = randomUUID();
      registerLiveRemuxToken(
        token,
        () => activeFile.createReadStream() as unknown as Readable,
        activeFile.name,
      );
      return {
        ok: true,
        session: {
          torrentId,
          title: source.title,
          posterUrl: source.posterUrl,
          url: buildMediaUrl(token, port),
          filePath: source.filePath,
          sourcePath: source.filePath,
          remuxed: true,
          live: true,
          seekable: false,
        },
      };
    }

    if (await fileExists(source.filePath) && canDirectPlay(source.filePath)) {
      const { port } = await ensureMediaServer();
      const token = randomUUID();
      registerMediaToken(token, source.filePath);
      return {
        ok: true,
        session: {
          torrentId,
          title: source.title,
          posterUrl: source.posterUrl,
          url: buildMediaUrl(token, port),
          filePath: source.filePath,
          sourcePath: source.filePath,
          remuxed: false,
          live: true,
          seekable: false,
        },
      };
    }

    return {
      ok: false,
      error: 'Пока нет данных для воспроизведения — подожди немного или открой во внешнем плеере',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось подготовить воспроизведение';
    return { ok: false, error: message };
  }
}
