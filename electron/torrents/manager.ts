import { createHash, randomUUID } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
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
import { isFileDownloadComplete, sortVideoFilesByEpisode } from './episodeOrder';
import { listInstalledMediaPlayers, openFileWithPlayer } from '../media/players';

type WebTorrentFile = {
  name: string;
  path: string;
  length: number;
  progress: number;
  downloaded?: number;
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
  paused: boolean;
  files: WebTorrentFile[];
  path: string;
  pause: () => void;
  resume: () => void;
  destroy: (opts?: { destroyStore?: boolean }, cb?: (err?: Error | string) => void) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

let clientPromise: Promise<WebTorrentClient> | null = null;
let records: TorrentDownloadRecord[] = [];
let ready = false;
const listeners = new Set<(items: TorrentDownloadRecord[]) => void>();
const activeTorrents = new Map<string, WebTorrentTorrent>();
/** While watching a specific episode — download that file first; then resume season order. */
const playbackFocusById = new Map<string, string>();
/** Serialize start/stop so only one torrent downloads at a time. */
let queuePump: Promise<void> | null = null;
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

function mapFiles(
  torrent: WebTorrentTorrent,
  previous: TorrentDownloadFile[] = [],
): TorrentDownloadFile[] {
  const mapped = (torrent.files ?? []).map((file) => {
    const diskPath = path.isAbsolute(file.path) ? file.path : path.join(torrent.path, file.path);
    const prev = previous.find(
      (item) =>
        path.normalize(item.path) === path.normalize(diskPath) || item.name === file.name,
    );
    let progress = 0;
    try {
      progress = Math.min(1, Math.max(0, Number(file.progress) || 0));
      if (file.done) {
        progress = 1;
      }
    } catch {
      progress = 0;
    }
    // Keep last known progress while WebTorrent re-verifies pieces after resume.
    progress = Math.max(prev?.progress ?? 0, progress);
    return {
      name: file.name,
      path: diskPath,
      length: file.length > 0 ? file.length : prev?.length || 0,
      progress,
    };
  });

  // Never wipe a known file list (pause/resume can briefly report files=[]).
  if (mapped.length === 0 && previous.length > 0) {
    return previous;
  }
  return mapped;
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
  // Defer so we don't re-enter an in-flight queue pump.
  queueMicrotask(() => {
    void pumpDownloadQueue();
  });
}

/** Drop swarm for a torrent but keep progress — used to free the single download slot. */
async function parkForQueue(id: string): Promise<void> {
  if (activeTorrents.has(id)) {
    await destroyActiveTorrent(id, false);
  }
  const record = records.find((item) => item.id === id);
  if (!record) {
    return;
  }
  if (record.status === 'downloading' || record.status === 'queued') {
    patchRecord(id, { status: 'queued', downloadSpeed: 0, error: undefined });
  }
}

/**
 * One active download at a time (FIFO by addedAt).
 * Others stay queued — island won't flicker between posters.
 */
function pumpDownloadQueue(): Promise<void> {
  if (queuePump) {
    return queuePump;
  }
  queuePump = (async () => {
    try {
      await initTorrentManager();

      const downloading = records
        .filter((item) => item.status === 'downloading')
        .sort((a, b) => a.addedAt - b.addedAt);

      // Collapse parallel downloads into a single slot.
      for (const extra of downloading.slice(1)) {
        await parkForQueue(extra.id);
      }

      const active = records
        .filter((item) => item.status === 'downloading')
        .sort((a, b) => a.addedAt - b.addedAt)[0];

      if (active) {
        if (!activeTorrents.has(active.id)) {
          await startTorrentEngine(active.id);
        }
        emit();
        return;
      }

      const next = records
        .filter((item) => item.status === 'queued')
        .sort((a, b) => a.addedAt - b.addedAt)[0];

      if (next) {
        await startTorrentEngine(next.id);
      }
      emit();
    } finally {
      queuePump = null;
    }
  })();
  return queuePump;
}

/**
 * Download one episode at a time: S01E01 → done → S01E02 → …
 * Non-video / later episodes stay deselected so the swarm isn't split.
 */
function applySequentialFileSelection(id: string, preferredPath?: string | null): void {
  const torrent = activeTorrents.get(id);
  if (!torrent?.files?.length) {
    return;
  }

  const record = records.find((item) => item.id === id);
  if (record?.status === 'paused' || torrent.paused) {
    return;
  }

  const focusPath = preferredPath ?? playbackFocusById.get(id) ?? null;
  if (focusPath) {
    const focused = resolveWebTorrentFile(torrent, focusPath, path.basename(focusPath));
    if (focused && !isFileDownloadComplete(focused)) {
      for (const file of torrent.files) {
        try {
          if (file === focused) {
            file.select(10);
          } else {
            file.deselect();
          }
        } catch {
          // ignore
        }
      }
      return;
    }
    playbackFocusById.delete(id);
  }

  const videos = sortVideoFilesByEpisode(torrent.files);
  if (videos.length === 0) {
    // No video names matched — keep WebTorrent default selection.
    return;
  }

  const next = videos.find((file) => !isFileDownloadComplete(file));
  if (!next) {
    // All videos done: allow remaining files (subs, etc.).
    for (const file of torrent.files) {
      try {
        if (!isFileDownloadComplete(file)) {
          file.select();
        }
      } catch {
        // ignore
      }
    }
    return;
  }

  for (const file of torrent.files) {
    try {
      if (file === next) {
        file.select(10);
      } else {
        file.deselect();
      }
    } catch {
      // ignore
    }
  }
}

function bindTorrent(id: string, torrent: WebTorrentTorrent) {
  activeTorrents.set(id, torrent);

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSequentialAt = 0;
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
      const current = records.find((item) => item.id === id);
      const stats = readTorrentStats(torrent);
      const done = stats.done || stats.progress >= 0.999;
      const paused = Boolean(torrent.paused) || current?.status === 'paused';

      // Don't revive a user-paused torrent into "downloading".
      if (paused && !done) {
        patchRecord(id, {
          title: stats.name || current?.title || 'Торрент',
          progress: Math.max(current?.progress ?? 0, stats.progress || 0),
          downloadSpeed: 0,
          uploaded: Math.max(current?.uploaded ?? 0, stats.uploaded || 0),
          downloaded: Math.max(current?.downloaded ?? 0, stats.downloaded || 0),
          length: stats.length > 0 ? stats.length : current?.length || 0,
          status: 'paused',
          files: mapFiles(torrent, current?.files ?? []),
          savePath: torrent.path || current?.savePath || getTorrentsDownloadsDir(),
          error: undefined,
        });
        schedulePersist();
        emit();
        return;
      }

      // Advance episode queue (throttled on hot download path).
      const now = Date.now();
      if (done || now - lastSequentialAt > 1200) {
        lastSequentialAt = now;
        applySequentialFileSelection(id);
      }

      const nextFiles = mapFiles(torrent, current?.files ?? []);
      // Prefetch seekable remux for episodes that just finished while season continues.
      for (const file of nextFiles) {
        const prev = current?.files.find(
          (item) =>
            path.normalize(item.path) === path.normalize(file.path) || item.name === file.name,
        );
        const wasDone = (prev?.progress ?? 0) >= 0.999;
        const isDone = (file.progress ?? 0) >= 0.999;
        if (isDone && !wasDone && file.path) {
          void import('../media/remux')
            .then((mod) => {
              mod.startBackgroundPlayableCache(file.path);
            })
            .catch(() => {
              // ignore
            });
        }
      }

      patchRecord(id, {
        title: stats.name || current?.title || 'Торрент',
        // Never drop below last known % (resume re-check starts at 0 briefly).
        progress: done
          ? Math.min(1, stats.progress || 1)
          : Math.max(current?.progress ?? 0, Math.min(1, stats.progress || 0)),
        downloadSpeed: done ? 0 : stats.downloadSpeed,
        uploaded: Math.max(current?.uploaded ?? 0, stats.uploaded || 0),
        downloaded: Math.max(current?.downloaded ?? 0, stats.downloaded || 0),
        length: stats.length > 0 ? stats.length : current?.length || 0,
        status: done ? 'done' : 'downloading',
        files: nextFiles,
        savePath: torrent.path || current?.savePath || getTorrentsDownloadsDir(),
        error: undefined,
      });
      if (done) {
        void persist().then(() => pumpDownloadQueue());
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
    applySequentialFileSelection(id);
    syncProgress();
  });
  torrent.on('ready', () => {
    applySequentialFileSelection(id);
    syncProgress();
  });
  torrent.on('download', () => {
    syncProgress();
  });
  torrent.on('done', () => {
    applySequentialFileSelection(id);
    syncProgress();
  });
  torrent.on('error', (error: unknown) => {
    markTorrentError(id, error);
  });
  torrent.on('warning', (error: unknown) => {
    console.warn('[torrents] warning', error);
  });

  applySequentialFileSelection(id);
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

  // One active download slot: oldest unfinished first, rest stay queued.
  const pending = records
    .filter((item) => item.status === 'downloading' || item.status === 'queued')
    .sort((a, b) => a.addedAt - b.addedAt);
  for (const item of pending) {
    patchRecord(item.id, { status: 'queued', downloadSpeed: 0 });
  }
  void persist();
  emit();
  void pumpDownloadQueue();
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

  const magnet = enrichMagnet(payload.magnet);
  if (magnet !== payload.magnet) {
    record.magnet = magnet;
  }

  records.unshift(record);
  await persist();
  emit();
  await pumpDownloadQueue();
  return { ok: true, torrent: records.find((item) => item.id === id)! };
}

async function destroyActiveTorrent(id: string, deleteFiles = false): Promise<void> {
  const active = activeTorrents.get(id);
  if (!active) {
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      active.destroy({ destroyStore: deleteFiles }, () => resolve());
    } catch {
      resolve();
    }
  });
  activeTorrents.delete(id);
  playbackFocusById.delete(id);
}

async function startTorrentEngine(id: string): Promise<void> {
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
    patchRecord(id, { status: 'downloading', error: undefined, downloadSpeed: 0 });
    await persist();
    emit();
  } catch (error) {
    markTorrentError(id, error instanceof Error ? error : 'Не удалось возобновить загрузку');
  }
}

/** Pause download without wiping verified progress. */
export async function pauseTorrent(id: string): Promise<TorrentDownloadRecord[]> {
  await initTorrentManager();
  const record = records.find((item) => item.id === id);
  if (!record || record.status === 'done') {
    return listTorrents();
  }

  // Drop swarm so the single download slot can move to the next queued item.
  if (activeTorrents.has(id)) {
    await destroyActiveTorrent(id, false);
  }

  patchRecord(id, {
    status: 'paused',
    downloadSpeed: 0,
    error: undefined,
    // Keep progress/downloaded as-is.
  });
  await persist();
  emit();
  await pumpDownloadQueue();
  return listTorrents();
}

/**
 * Resume download from last progress.
 * If engine still alive → resume in-place; else re-attach to files on disk.
 * If already downloading (stall kick) → reconnect swarm.
 */
export async function resumeTorrentDownload(id: string): Promise<TorrentDownloadRecord[]> {
  await initTorrentManager();
  const record = records.find((item) => item.id === id);
  if (!record || record.status === 'done') {
    return listTorrents();
  }

  const otherDownloading = records.some(
    (item) => item.id !== id && item.status === 'downloading',
  );

  // Slot busy → join FIFO queue instead of running in parallel (island flicker).
  if (otherDownloading) {
    if (activeTorrents.has(id)) {
      await destroyActiveTorrent(id, false);
    }
    patchRecord(id, {
      status: 'queued',
      downloadSpeed: 0,
      error: undefined,
    });
    await persist();
    emit();
    return listTorrents();
  }

  const active = activeTorrents.get(id);

  // Soft resume — keep piece bitfield / progress; continue episode queue.
  if (active && record.status === 'paused') {
    try {
      active.resume();
      patchRecord(id, {
        status: 'downloading',
        error: undefined,
        downloadSpeed: 0,
      });
      applySequentialFileSelection(id);
      await persist();
      emit();
      return listTorrents();
    } catch {
      await destroyActiveTorrent(id, false);
    }
  }

  // Stall kick / cold start after app relaunch: reconnect, progress stays via monotonic sync.
  if (active) {
    await destroyActiveTorrent(id, false);
  }

  patchRecord(id, { status: 'queued', error: undefined, downloadSpeed: 0 });
  try {
    await startTorrentEngine(id);
  } catch (error) {
    markTorrentError(id, error instanceof Error ? error : 'Не удалось продолжить загрузку');
  }
  return listTorrents();
}

export async function removeTorrent(id: string, deleteFiles = false): Promise<TorrentDownloadRecord[]> {
  await initTorrentManager();
  const record = records.find((item) => item.id === id);
  const active = activeTorrents.get(id);

  if (active) {
    await destroyActiveTorrent(id, deleteFiles);
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
  playbackFocusById.delete(id);
  await persist();
  await pumpDownloadQueue();
  return listTorrents();
}

function isDownloadFileComplete(file: TorrentDownloadFile | undefined): boolean {
  if (!file) {
    return false;
  }
  return Math.min(1, Math.max(0, file.progress ?? 0)) >= 0.999;
}

/** Bring a torrent online for play-while-download (may steal the single download slot). */
export async function ensureTorrentEngineForPlayback(
  id: string,
  filePath?: string | null,
): Promise<void> {
  await initTorrentManager();
  const record = records.find((item) => item.id === id);
  if (!record || record.status === 'done') {
    return;
  }

  // Finished episode on disk → play from file, don't yank the swarm off the next episode.
  const preferred = resolveRecordVideoFile(record, filePath);
  if (isDownloadFileComplete(preferred) && preferred?.path) {
    try {
      await access(preferred.path);
      return;
    } catch {
      // Missing on disk — fall through and re-attach engine.
    }
  }

  for (const item of records) {
    if (item.id !== id && item.status === 'downloading') {
      await parkForQueue(item.id);
    }
  }

  const active = activeTorrents.get(id);
  if (active) {
    try {
      if (active.paused) {
        active.resume();
      }
    } catch {
      // ignore
    }
    patchRecord(id, { status: 'downloading', error: undefined, downloadSpeed: 0 });
    applySequentialFileSelection(id);
    emit();
    return;
  }

  patchRecord(id, { status: 'queued', error: undefined, downloadSpeed: 0 });
  await startTorrentEngine(id);
}

function pickVideoFile<T extends { name: string; length: number }>(files: T[]): T | undefined {
  return sortVideoFilesByEpisode(files)[0] ?? [...files].sort((a, b) => b.length - a.length)[0];
}

function resolveRecordVideoFile(
  record: TorrentDownloadRecord,
  filePath?: string | null,
): TorrentDownloadFile | undefined {
  if (filePath) {
    const normalized = path.normalize(filePath);
    return (
      record.files.find((file) => path.normalize(file.path) === normalized) ??
      record.files.find(
        (file) => file.name === filePath || path.basename(file.path) === path.basename(filePath),
      )
    );
  }
  return pickVideoFile(record.files);
}

function resolveWebTorrentFile(
  torrent: WebTorrentTorrent,
  absolutePath?: string | null,
  fileName?: string | null,
): WebTorrentFile | undefined {
  if (absolutePath || fileName) {
    const normalized = absolutePath ? path.normalize(absolutePath) : null;
    const match = torrent.files.find((file) => {
      const diskPath = path.isAbsolute(file.path) ? file.path : path.join(torrent.path, file.path);
      if (normalized && path.normalize(diskPath) === normalized) {
        return true;
      }
      if (fileName && (file.name === fileName || path.basename(file.path) === path.basename(fileName))) {
        return true;
      }
      return false;
    });
    if (match) {
      return match;
    }
  }
  return pickVideoFile(torrent.files);
}

export function getTorrentPlaybackSource(
  id: string,
  filePath?: string | null,
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

  const preferred = resolveRecordVideoFile(record, filePath);
  if (!preferred?.path) {
    return {
      ok: false,
      error: filePath
        ? 'Выбранный файл не найден в торренте'
        : 'Метаданные ещё качаются — подожди пару секунд',
    };
  }
  const target = preferred.path;

  const baseTitle = record.mediaTitle || record.title || 'Видео';
  const episodeTitle =
    preferred.name && preferred.name !== baseTitle ? `${baseTitle} · ${preferred.name}` : baseTitle;

  // Per-file completeness — series can be mid-season while S01E01 is already 100%.
  const fileProgress = Math.min(1, Math.max(0, preferred.progress ?? 0));
  const fileDone = fileProgress >= 0.999;
  const torrentDone = record.status === 'done' || record.progress >= 0.999;

  // Prefer live WebTorrent file progress when engine is up (more accurate than persisted).
  const active = activeTorrents.get(id);
  let liveDone = fileDone;
  let liveProgress = fileProgress;
  if (active) {
    const live = resolveWebTorrentFile(active, target, preferred.name);
    if (live) {
      try {
        liveProgress = Math.max(
          fileProgress,
          live.done ? 1 : Math.min(1, Math.max(0, Number(live.progress) || 0)),
        );
        liveDone = live.done || liveProgress >= 0.999;
      } catch {
        // ignore
      }
    }
  }

  return {
    ok: true,
    filePath: target,
    fileName: preferred.name || path.basename(target),
    title: episodeTitle,
    posterUrl: record.posterUrl,
    done: torrentDone || liveDone,
    progress: liveProgress,
  };
}

/** Prioritize video file pieces from the start (play-while-download). */
export function prioritizeTorrentPlayback(
  id: string,
  filePath?: string | null,
): WebTorrentFile | null {
  const torrent = activeTorrents.get(id);
  if (!torrent?.files?.length) {
    return null;
  }

  const record = records.find((item) => item.id === id);
  const preferredName = filePath
    ? record?.files.find((file) => path.normalize(file.path) === path.normalize(filePath))?.name
    : undefined;
  const video = resolveWebTorrentFile(torrent, filePath, preferredName ?? filePath);
  if (!video) {
    return null;
  }

  const diskPath = path.isAbsolute(video.path) ? video.path : path.join(torrent.path, video.path);
  playbackFocusById.set(id, diskPath);

  // Play-while-download: wake swarm even if user paused the download.
  try {
    if (torrent.paused) {
      torrent.resume();
    }
  } catch {
    // ignore
  }

  const recordStatus = records.find((item) => item.id === id);
  if (recordStatus?.status === 'paused') {
    patchRecord(id, { status: 'downloading', error: undefined });
  }

  applySequentialFileSelection(id, diskPath);
  emit();

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
  filePath?: string | null,
): Promise<OpenInPlayerResult> {
  await initTorrentManager();
  const source = getTorrentPlaybackSource(id, filePath);
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

export async function openTorrentFile(
  id: string,
  filePath?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const source = getTorrentPlaybackSource(id, filePath);
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
