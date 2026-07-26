import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type {
  OpenInPlayerResult,
  TorrentAddPayload,
  TorrentAddResult,
  TorrentDownloadFile,
  TorrentDownloadRecord,
} from '../../contracts/ipc';
import { ensureTorrentsDirs, getTorrentsDownloadsDir, getTorrentsRoot } from './paths';
import { loadTorrentState, saveTorrentState } from './store';
import { listInstalledMediaPlayers, openFileWithPlayer } from '../media/players';

type WebTorrentFile = {
  name: string;
  path: string;
  length: number;
  progress: number;
  done: boolean;
  type: string;
  select: (priority?: number) => void;
  deselect: () => void;
  createReadStream: (opts?: { start?: number; end?: number }) => NodeJS.ReadableStream;
};

type WebTorrentServer = {
  listen: (port: number, hostname: string, cb?: () => void) => void;
  address: () => { port: number } | string | null;
  close: (cb?: () => void) => void;
  destroy: (cb?: () => void) => void;
  pathname: string;
};

type WebTorrentClient = {
  add: (
    magnet: string,
    opts: { path: string },
    cb?: (torrent: WebTorrentTorrent) => void,
  ) => WebTorrentTorrent;
  get: (id: string) => Promise<WebTorrentTorrent | null> | WebTorrentTorrent | undefined;
  remove: (id: string, opts?: { destroyStore?: boolean }, cb?: (err?: Error | string) => void) => void;
  destroy: (cb?: (err?: Error) => void) => void;
  createServer: (opts?: { origin?: string; hostname?: string; pathname?: string }) => WebTorrentServer;
  ready: boolean;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type WebTorrentTorrent = {
  infoHash: string;
  name: string;
  magneURI?: string;
  magnetURI?: string;
  progress: number;
  downloadSpeed: number;
  uploaded: number;
  downloaded: number;
  length: number;
  done: boolean;
  files: WebTorrentFile[];
  path: string;
  destroy: (opts?: { destroyStore?: boolean }, cb?: (err?: Error | string) => void) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

let clientPromise: Promise<WebTorrentClient> | null = null;
let records: TorrentDownloadRecord[] = [];
let ready = false;
const listeners = new Set<(items: TorrentDownloadRecord[]) => void>();
const activeTorrents = new Map<string, WebTorrentTorrent>();
let webTorrentServer: WebTorrentServer | null = null;
let webTorrentServerPort: number | null = null;

function magnetKey(magnet: string): string {
  return createHash('sha1').update(magnet.trim()).digest('hex').slice(0, 16);
}

/** Skip data:/blob: posters — they bloat state.json to megabytes. */
function sanitizePosterUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return undefined;
  }
  return trimmed;
}

/** Vokino often returns bare btih magnets without trackers — DHT alone is too slow/unreliable. */
const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'http://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'http://bt3.t-ru.org/ann?magnet',
  'http://bt4.t-ru.org/ann?magnet',
  'http://retracker.local/announce',
];

export function enrichMagnet(magnet: string): string {
  let trimmed = magnet.trim();
  if (!trimmed.startsWith('magnet:')) {
    return trimmed;
  }

  // Repair over-encoded magnets from URL.toString() (xt=urn%3Abtih%3A…)
  trimmed = trimmed
    .replace(/([?&]xt=)urn%3Abtih%3A/gi, '$1urn:btih:')
    .replace(/([?&]xt=)URN%3ABTIH%3A/g, '$1urn:btih:');

  // Do NOT use URL.toString() — it percent-encodes xt=urn:btih:… and parse-torrent
  // then treats the magnet as a filesystem path → "Invalid torrent identifier".
  const existing = new Set<string>();
  for (const match of trimmed.matchAll(/[?&]tr=([^&]*)/gi)) {
    try {
      existing.add(decodeURIComponent(match[1] ?? ''));
    } catch {
      existing.add(match[1] ?? '');
    }
  }

  const extras = DEFAULT_TRACKERS.filter((tracker) => !existing.has(tracker))
    .map((tracker) => `tr=${encodeURIComponent(tracker)}`)
    .join('&');

  if (!extras) {
    return trimmed;
  }
  return trimmed.includes('?') ? `${trimmed}&${extras}` : `${trimmed}?${extras}`;
}

function readTorrentStats(torrent: WebTorrentTorrent): {
  progress: number;
  downloadSpeed: number;
  uploaded: number;
  downloaded: number;
  length: number;
  done: boolean;
  name: string;
} {
  try {
    return {
      progress: Math.min(1, Math.max(0, torrent.progress || 0)),
      downloadSpeed: torrent.downloadSpeed || 0,
      uploaded: torrent.uploaded || 0,
      downloaded: torrent.downloaded || 0,
      length: torrent.length || 0,
      done: Boolean(torrent.done),
      name: torrent.name || '',
    };
  } catch {
    return {
      progress: 0,
      downloadSpeed: 0,
      uploaded: 0,
      downloaded: 0,
      length: torrent.length || 0,
      done: Boolean(torrent.done),
      name: torrent.name || '',
    };
  }
}

function emit() {
  const snapshot = [...records].sort((a, b) => b.addedAt - a.addedAt);
  for (const listener of listeners) {
    listener(snapshot);
  }
}

async function persist() {
  await saveTorrentState(records);
  emit();
}

async function getClient(): Promise<WebTorrentClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const mod = await import('webtorrent');
      const WebTorrentCtor = mod.default;
      return new WebTorrentCtor() as unknown as WebTorrentClient;
    })();
  }
  return clientPromise;
}

function mapFiles(torrent: WebTorrentTorrent): TorrentDownloadFile[] {
  return (torrent.files ?? []).map((file) => ({
    name: file.name,
    path: path.isAbsolute(file.path) ? file.path : path.join(torrent.path, file.path),
    length: file.length,
  }));
}

function patchRecord(id: string, patch: Partial<TorrentDownloadRecord>) {
  const index = records.findIndex((item) => item.id === id);
  if (index < 0) {
    return;
  }
  records[index] = {
    ...records[index]!,
    ...patch,
    updatedAt: Date.now(),
  };
}

function markTorrentError(id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  patchRecord(id, { status: 'error', error: message, downloadSpeed: 0 });
  void persist();
}

function bindTorrent(id: string, torrent: WebTorrentTorrent) {
  activeTorrents.set(id, torrent);

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (persistTimer) {
      return;
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void persist();
    }, 750);
  };

  const syncProgress = () => {
    try {
      const stats = readTorrentStats(torrent);
      const done = stats.done || stats.progress >= 0.999;
      patchRecord(id, {
        title: stats.name || records.find((item) => item.id === id)?.title || 'Торрент',
        progress: stats.progress,
        downloadSpeed: stats.downloadSpeed,
        uploaded: stats.uploaded,
        downloaded: stats.downloaded,
        length: stats.length,
        status: done ? 'done' : 'downloading',
        files: mapFiles(torrent),
        savePath: torrent.path || getTorrentsDownloadsDir(),
        error: undefined,
      });
      if (done) {
        void persist();
      } else {
        schedulePersist();
        emit();
      }
    } catch (error) {
      // WebTorrent can throw on progress getters mid-swarm; don't kill the download.
      console.warn('[torrents] syncProgress failed', error);
    }
  };

  torrent.on('infoHash', () => {
    syncProgress();
  });
  torrent.on('metadata', () => {
    syncProgress();
  });
  torrent.on('ready', () => {
    syncProgress();
  });
  torrent.on('download', () => {
    syncProgress();
  });
  torrent.on('done', () => {
    syncProgress();
  });
  torrent.on('error', (error: unknown) => {
    markTorrentError(id, error);
  });
  torrent.on('warning', (error: unknown) => {
    console.warn('[torrents] warning', error);
  });

  syncProgress();
}

export function onTorrentsChanged(listener: (items: TorrentDownloadRecord[]) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function initTorrentManager(): Promise<void> {
  if (ready) {
    return;
  }
  await ensureTorrentsDirs();
  records = (await loadTorrentState()).map((item) => ({
    ...item,
    posterUrl: sanitizePosterUrl(item.posterUrl),
  }));
  ready = true;
  void persist();

  // Resume unfinished downloads
  const pending = records.filter(
    (item) => item.status === 'downloading' || item.status === 'queued' || item.status === 'error',
  );
  for (const item of pending) {
    if (item.status === 'error') {
      continue;
    }
    void resumeTorrent(item.id).catch((error) => {
      markTorrentError(item.id, error instanceof Error ? error : 'Не удалось возобновить загрузку');
    });
  }
}

export function listTorrents(): TorrentDownloadRecord[] {
  return [...records].sort((a, b) => b.addedAt - a.addedAt);
}

export function getTorrentsFolderPath(): string {
  return getTorrentsRoot();
}

export async function addTorrent(payload: TorrentAddPayload): Promise<TorrentAddResult> {
  await initTorrentManager();

  if (!payload.magnet?.startsWith('magnet:')) {
    return { ok: false, error: 'Некорректная magnet-ссылка' };
  }

  const existing = records.find((item) => item.magnet === payload.magnet);
  if (existing) {
    return { ok: true, torrent: existing };
  }

  const now = Date.now();
  const id = `${magnetKey(payload.magnet)}-${randomUUID().slice(0, 8)}`;
  const downloads = getTorrentsDownloadsDir();
  const record: TorrentDownloadRecord = {
    id,
    magnet: payload.magnet,
    title: payload.title || payload.mediaTitle || 'Торрент',
    mediaId: payload.mediaId,
    mediaTitle: payload.mediaTitle,
    posterUrl: sanitizePosterUrl(payload.posterUrl),
    quality: payload.quality ?? null,
    sizeName: payload.sizeName,
    trackerName: payload.trackerName,
    status: 'queued',
    progress: 0,
    downloadSpeed: 0,
    uploaded: 0,
    downloaded: 0,
    length: 0,
    savePath: downloads,
    files: [],
    addedAt: now,
    updatedAt: now,
  };

  records.unshift(record);
  await persist();

  try {
    const client = await getClient();
    const magnet = enrichMagnet(payload.magnet);
    if (magnet !== payload.magnet) {
      patchRecord(id, { magnet });
    }
    const torrent = client.add(magnet, { path: downloads });
    bindTorrent(id, torrent);
    patchRecord(id, { status: 'downloading' });
    await persist();
    return { ok: true, torrent: records.find((item) => item.id === id)! };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось начать загрузку';
    markTorrentError(id, message);
    return { ok: false, error: message };
  }
}

async function resumeTorrent(id: string): Promise<void> {
  const record = records.find((item) => item.id === id);
  if (!record || activeTorrents.has(id)) {
    return;
  }
  const client = await getClient();
  const magnet = enrichMagnet(record.magnet);
  if (magnet !== record.magnet) {
    patchRecord(id, { magnet });
  }
  try {
    const torrent = client.add(magnet, { path: record.savePath || getTorrentsDownloadsDir() });
    bindTorrent(id, torrent);
    patchRecord(id, { status: 'downloading', error: undefined });
    await persist();
  } catch (error) {
    markTorrentError(id, error instanceof Error ? error : 'Не удалось возобновить загрузку');
  }
}

export async function removeTorrent(id: string, deleteFiles = false): Promise<TorrentDownloadRecord[]> {
  await initTorrentManager();
  const record = records.find((item) => item.id === id);
  const active = activeTorrents.get(id);

  if (active) {
    await new Promise<void>((resolve) => {
      active.destroy({ destroyStore: deleteFiles }, () => resolve());
    });
    activeTorrents.delete(id);
  } else if (deleteFiles && record?.savePath) {
    // Best-effort cleanup of known files
    for (const file of record.files) {
      try {
        await rm(file.path, { force: true });
      } catch {
        // ignore
      }
    }
  }

  records = records.filter((item) => item.id !== id);
  await persist();
  return listTorrents();
}

const VIDEO_EXT = /\.(mkv|mp4|avi|mov|wmv|m4v|webm|ts)$/i;

function pickVideoFile<T extends { name: string; length: number }>(files: T[]): T | undefined {
  return files.find((file) => VIDEO_EXT.test(file.name)) ?? [...files].sort((a, b) => b.length - a.length)[0];
}

export function getTorrentPlaybackSource(
  id: string,
):
  | {
      ok: true;
      filePath: string;
      title: string;
      posterUrl?: string;
      done: boolean;
      progress: number;
      fileName: string;
    }
  | { ok: false; error: string } {
  const record = records.find((item) => item.id === id);
  if (!record) {
    return { ok: false, error: 'Торрент не найден' };
  }

  const preferred = pickVideoFile(record.files);
  const target = preferred?.path;
  if (!target) {
    return { ok: false, error: 'Метаданные ещё качаются — подожди пару секунд' };
  }

  return {
    ok: true,
    filePath: target,
    fileName: preferred?.name || path.basename(target),
    title: record.mediaTitle || record.title || preferred?.name || 'Видео',
    posterUrl: record.posterUrl,
    done: record.status === 'done' || record.progress >= 0.999,
    progress: record.progress,
  };
}

/** Prioritize video file pieces from the start (play-while-download). */
export function prioritizeTorrentPlayback(id: string): WebTorrentFile | null {
  const torrent = activeTorrents.get(id);
  if (!torrent?.files?.length) {
    return null;
  }

  const video = pickVideoFile(torrent.files);
  if (!video) {
    return null;
  }

  for (const file of torrent.files) {
    if (file === video) {
      file.select(10);
    } else {
      try {
        file.deselect();
      } catch {
        // ignore
      }
    }
  }

  return video;
}

export async function ensureWebTorrentHttpServer(): Promise<{ port: number; pathname: string }> {
  if (webTorrentServer && webTorrentServerPort != null) {
    return { port: webTorrentServerPort, pathname: webTorrentServer.pathname || '/webtorrent' };
  }

  const client = await getClient();
  const server = client.createServer({ origin: '*', hostname: '127.0.0.1' });
  await new Promise<void>((resolve, reject) => {
    try {
      server.listen(0, '127.0.0.1', () => resolve());
    } catch (error) {
      reject(error);
    }
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('WebTorrent server failed to bind');
  }

  webTorrentServer = server;
  webTorrentServerPort = address.port;
  return { port: address.port, pathname: server.pathname || '/webtorrent' };
}

export function buildWebTorrentFileUrl(
  port: number,
  pathname: string,
  infoHash: string,
  filePath: string,
): string {
  const normalized = filePath.replace(/\\/g, '/');
  const encodedPath = normalized
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const base = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return `http://127.0.0.1:${port}${base}/${infoHash}/${encodedPath}`;
}

export function getActiveWebTorrent(id: string): WebTorrentTorrent | undefined {
  return activeTorrents.get(id);
}

export async function openTorrentInPlayer(
  id: string,
  playerId: string,
): Promise<OpenInPlayerResult> {
  await initTorrentManager();
  const source = getTorrentPlaybackSource(id);
  if (!source.ok) {
    return source;
  }

  if (playerId === 'vodomerka') {
    return { ok: true, action: 'native' };
  }

  const players = await listInstalledMediaPlayers();
  const player = players.find((item) => item.id === playerId && item.installed);
  if (!player) {
    return { ok: false, error: 'Плеер не установлен' };
  }

  const opened = await openFileWithPlayer(source.filePath, player);
  if (!opened.ok) {
    return { ok: false, error: opened.error ?? 'Не удалось открыть файл' };
  }
  return { ok: true, action: 'external' };
}

export async function openTorrentFile(id: string): Promise<{ ok: boolean; error?: string }> {
  const source = getTorrentPlaybackSource(id);
  if (!source.ok) {
    return source;
  }

  const result = await shell.openPath(source.filePath);
  if (result) {
    return { ok: false, error: result };
  }
  return { ok: true };
}

export async function openTorrentsFolder(): Promise<{ ok: boolean; error?: string }> {
  await ensureTorrentsDirs();
  const result = await shell.openPath(getTorrentsRoot());
  if (result) {
    return { ok: false, error: result };
  }
  return { ok: true };
}

export async function destroyTorrentManager(): Promise<void> {
  if (webTorrentServer) {
    try {
      await new Promise<void>((resolve) => {
        webTorrentServer?.destroy(() => resolve());
      });
    } catch {
      // ignore
    }
    webTorrentServer = null;
    webTorrentServerPort = null;
  }

  if (!clientPromise) {
    return;
  }
  try {
    const client = await clientPromise;
    await new Promise<void>((resolve) => {
      client.destroy(() => resolve());
    });
  } catch {
    // ignore
  }
  clientPromise = null;
  activeTorrents.clear();
}
