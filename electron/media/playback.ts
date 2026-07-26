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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Wait until selected file has some bytes (play-while-download). */
async function waitForFileBytes(
  file: { progress: number; done: boolean; downloaded?: number; length: number },
  timeoutMs = 12_000,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (file.done || file.progress >= 0.002) {
        return true;
      }
      if (typeof file.downloaded === 'number' && file.downloaded >= 256 * 1024) {
        return true;
      }
    } catch {
      // ignore transient webtorrent getter errors
    }
    await sleep(250);
  }
  try {
    return file.done || file.progress > 0 || (file.downloaded ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function prepareTorrentPlayback(
  torrentId: string,
  filePath?: string | null,
): Promise<MediaPreparePlaybackResult> {
  const source = getTorrentPlaybackSource(torrentId, filePath);
  if (!source.ok) {
    return source;
  }

  const activeFile = prioritizeTorrentPlayback(torrentId, filePath);
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

    // Incomplete episode: prioritize selected file and wait for first pieces.
    if (activeTorrent && activeFile) {
      const ready = await waitForFileBytes(activeFile);
      if (!ready) {
        const pct = Math.round(Math.min(1, Math.max(0, activeFile.progress || 0)) * 100);
        return {
          ok: false,
          error:
            pct > 0
              ? `Серия ещё качается (${pct}%) — подожди немного и открой снова`
              : 'Серия ещё не начала качаться — подожди появления пиров и открой снова',
        };
      }

      // Chromium-native container → WebTorrent HTTP (progressive)
      if (canDirectPlay(activeFile.name)) {
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

      // Enough on disk → remux from file; otherwise live pipe from WebTorrent
      const onDisk = await fileExists(source.filePath);
      const fileProgress = Math.min(1, Math.max(0, activeFile.progress || 0));
      if (onDisk && fileProgress >= 0.05) {
        const { port } = await ensureMediaServer();
        prioritizeTorrentPlayback(torrentId, filePath);
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
