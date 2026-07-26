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
import {
  formatPlaybackTitle,
  isFileDownloadComplete,
  sortVideoFilesByEpisode,
} from './episodeOrder';
import { listInstalledMediaPlayers, openFileWithPlayer } from '../media/players';

type WebTorrentFile = {
  name: string;
  path: string;
  length: number;
  progress: number;
  downloaded?: number;
  done: boolean;
  type: string;
  /** Inclusive piece range for this file (WebTorrent internals). */
  _startPiece?: number;
  _endPiece?: number;
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

type WebTorrentAddOpts = {
  path: string;
  /** Start with no pieces selected — required for sequential episode downloads. */
  deselect?: boolean;
  strategy?: 'sequential' | 'rarest';
};

type WebTorrentClient = {
  add: (
    magnet: string,
    opts: WebTorrentAddOpts,
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
  pieces: unknown[];
  path: string;
  pause: () => void;
  resume: () => void;
  /** Select piece range [start, end] inclusive. */
  select: (start: number, end: number, priority?: number) => void;
  /** Clear piece range selection — needed before exclusive file select. */
  deselect: (start: number, end: number) => void;
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
const stallWatchdogs = new Map<string, ReturnType<typeof setInterval>>();
const lastStallKickAt = new Map<string, number>();
let webTorrentServer: WebTorrentServer | null = null;
let webTorrentServerPort: number | null = null;

const STALL_SPEED_BPS = 2 * 1024; // below ~2 KiB/s counts as stalled
const STALL_AFTER_MS = 40_000;
const STALL_KICK_COOLDOWN_MS = 90_000;

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
];

/** ISP-only / dead trackers that spam ENOTFOUND and never help outside that LAN. */
function isUselessTracker(tracker: string): boolean {
  const value = tracker.trim().toLowerCase();
  return (
    value.includes('retracker.local') ||
    value.includes('.local/') ||
    value.endsWith('.local') ||
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('[::1]')
  );
}

function trackerWarningMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === 'string'
          ? error.cause
          : '';
    return `${error.message}${cause ? ` (${cause})` : ''}`;
  }
  return String(error);
}

/** Expected swarm noise — not actionable, don't dump stacks every few seconds. */
function isBenignTrackerWarning(error: unknown): boolean {
  const text = trackerWarningMessage(error).toLowerCase();
  return (
    text.includes('retracker.local') ||
    text.includes('enotfound') ||
    text.includes('torrent not registered') ||
    text.includes('no nodes to query') ||
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('econnrefused') ||
    text.includes('ehostunreach') ||
    text.includes('fetch failed')
  );
}

export function enrichMagnet(magnet: string): string {
  let trimmed = magnet.trim();
  if (!trimmed.startsWith('magnet:')) {
    return trimmed;
  }

  // Repair over-encoded magnets from URL.toString() (xt=urn%3Abtih%3A…)
  trimmed = trimmed
    .replace(/([?&]xt=)urn%3Abtih%3A/gi, '$1urn:btih:')
    .replace(/([?&]xt=)URN%3ABTIH%3A/g, '$1urn:btih:');

  // Drop ISP-local trackers baked into magnets (retracker.local → ENOTFOUND for everyone else).
  trimmed = trimmed
    .replace(/[?&]tr=[^&]*retracker\.local[^&]*/gi, '')
    .replace(/[?&]tr=[^&]*\.local[^&]*/gi, '')
    .replace(/\?&/, '?')
    .replace(/&&+/g, '&')
    .replace(/\?$/, '')
    .replace(/&$/, '');

  // Do NOT use URL.toString() — it percent-encodes xt=urn:btih:… and parse-torrent
  // then treats the magnet as a filesystem path → "Invalid torrent identifier".
  const existing = new Set<string>();
  for (const match of trimmed.matchAll(/[?&]tr=([^&]*)/gi)) {
    let tracker = match[1] ?? '';
    try {
      tracker = decodeURIComponent(tracker);
    } catch {
      // keep raw
    }
    if (!tracker || isUselessTracker(tracker)) {
      continue;
    }
    existing.add(tracker);
  }

  const extras = DEFAULT_TRACKERS.filter(
    (tracker) => !existing.has(tracker) && !isUselessTracker(tracker),
  )
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
 * WebTorrent selects the WHOLE torrent by default — file.deselect() alone is not enough.
 * Must clear piece selections, then select only the target file's piece range.
 */
function selectOnlyTorrentFile(torrent: WebTorrentTorrent, target: WebTorrentFile): void {
  const pieceCount = torrent.pieces?.length ?? 0;
  if (pieceCount > 0) {
    try {
      torrent.deselect(0, pieceCount - 1);
    } catch {
      // ignore
    }
  }

  for (const file of torrent.files) {
    try {
      file.deselect();
    } catch {
      // ignore
    }
  }

  try {
    const start = target._startPiece;
    const end = target._endPiece;
    if (
      typeof start === 'number' &&
      typeof end === 'number' &&
      start >= 0 &&
      end >= start &&
      pieceCount > 0
    ) {
      torrent.select(start, end, 10);
    }
    target.select(10);
  } catch {
    try {
      target.select(10);
    } catch {
      // ignore
    }
  }
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
      selectOnlyTorrentFile(torrent, focused);
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

  selectOnlyTorrentFile(torrent, next);
}

function clearStallWatchdog(id: string): void {
  const timer = stallWatchdogs.get(id);
  if (timer) {
    clearInterval(timer);
    stallWatchdogs.delete(id);
  }
}

function bindTorrent(id: string, torrent: WebTorrentTorrent) {
  activeTorrents.set(id, torrent);
  clearStallWatchdog(id);

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSequentialAt = 0;
  let stalledSince: number | null = null;
  const schedulePersist = () => {
    if (persistTimer) {
      return;
    }
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void persist();
    }, 750);
  };

  const maybeKickStall = () => {
    const current = records.find((item) => item.id === id);
    if (!current || current.status !== 'downloading' || torrent.paused) {
      stalledSince = null;
      return;
    }
    if (!torrent.files?.length) {
      // Still waiting for metadata — not a swarm stall yet.
      stalledSince = null;
      return;
    }

    let speed = 0;
    try {
      speed = torrent.downloadSpeed || 0;
    } catch {
      speed = 0;
    }

    if (speed >= STALL_SPEED_BPS || current.progress >= 0.999) {
      stalledSince = null;
      return;
    }

    const now = Date.now();
    if (stalledSince == null) {
      stalledSince = now;
      return;
    }
    if (now - stalledSince < STALL_AFTER_MS) {
      return;
    }
    const lastKick = lastStallKickAt.get(id) ?? 0;
    if (now - lastKick < STALL_KICK_COOLDOWN_MS) {
      return;
    }

    lastStallKickAt.set(id, now);
    stalledSince = null;
    console.warn('[torrents] stall kick — reconnecting swarm', id, current.title);
    void resumeTorrentDownload(id);
  };

  stallWatchdogs.set(
    id,
    setInterval(() => {
      maybeKickStall();
    }, 5_000),
  );

  const syncProgress = () => {
    try {
      const current = records.find((item) => item.id === id);
      const stats = readTorrentStats(torrent);
      const done = stats.done || stats.progress >= 0.999;
      const paused = Boolean(torrent.paused) || current?.status === 'paused';

      // Don't revive a user-paused torrent into "downloading".
      if (paused && !done) {
        stalledSince = null;
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

      // Re-assert exclusive episode selection (WebTorrent can re-select the whole torrent).
      const now = Date.now();
      if (done || now - lastSequentialAt > 800) {
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
        stalledSince = null;
        clearStallWatchdog(id);
        void persist().then(() => pumpDownloadQueue());
      } else {
        if (stats.downloadSpeed >= STALL_SPEED_BPS) {
          stalledSince = null;
        }
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
    stalledSince = null;
    syncProgress();
  });
  torrent.on('done', () => {
    applySequentialFileSelection(id);
    syncProgress();
  });
  torrent.on('error', (error: unknown) => {
    clearStallWatchdog(id);
    markTorrentError(id, error);
  });
  torrent.on('warning', (error: unknown) => {
    if (isBenignTrackerWarning(error)) {
      return;
    }
    console.warn('[torrents] warning', trackerWarningMessage(error));
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

function isIncompleteRecord(record: TorrentDownloadRecord): boolean {
  return record.status !== 'done' && record.progress < 0.999;
}

/** Remove leftover incomplete download folders so a re-add doesn't hang on verify. */
async function wipeRecordDiskData(record: TorrentDownloadRecord): Promise<void> {
  const savePath = path.resolve(record.savePath || getTorrentsDownloadsDir());
  const candidates = new Set<string>();

  for (const file of record.files) {
    if (!file.path) {
      continue;
    }
    candidates.add(path.resolve(file.path));
    const parent = path.resolve(path.dirname(file.path));
    if (parent.startsWith(savePath + path.sep) && parent !== savePath) {
      candidates.add(parent);
    }
  }

  // WebTorrent usually writes Downloads/<torrentName>/...
  for (const name of [record.title, record.mediaTitle]) {
    const trimmed = name?.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..') {
      continue;
    }
    candidates.add(path.resolve(savePath, trimmed));
  }

  for (const target of candidates) {
    if (target === savePath || !target.startsWith(savePath + path.sep)) {
      continue;
    }
    try {
      await rm(target, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function wipeOrphanDownloadDir(savePath: string, torrentTitle?: string): Promise<void> {
  const trimmed = torrentTitle?.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..') {
    return;
  }
  const dir = path.resolve(savePath, trimmed);
  const root = path.resolve(savePath);
  if (dir === root || !dir.startsWith(root + path.sep)) {
    return;
  }
  const inUse = records.some(
    (item) =>
      item.title === trimmed ||
      item.files.some((file) => path.resolve(file.path).startsWith(dir + path.sep)),
  );
  if (inUse) {
    return;
  }
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export async function addTorrent(payload: TorrentAddPayload): Promise<TorrentAddResult> {
  await initTorrentManager();

  if (!payload.magnet?.startsWith('magnet:')) {
    return { ok: false, error: 'Некорректная magnet-ссылка' };
  }

  const magnet = enrichMagnet(payload.magnet);
  const key = magnetKey(magnet);
  const existing = records.find((item) => magnetKey(item.magnet) === key);
  if (existing) {
    if (
      existing.status === 'paused' ||
      existing.status === 'error' ||
      existing.status === 'queued' ||
      (existing.status === 'downloading' && existing.downloadSpeed < STALL_SPEED_BPS)
    ) {
      // Re-click "Скачать" / stalled swarm → reconnect instead of no-op.
      void resumeTorrentDownload(existing.id);
    }
    return { ok: true, torrent: existing };
  }

  const now = Date.now();
  const id = `${key}-${randomUUID().slice(0, 8)}`;
  const downloads = getTorrentsDownloadsDir();
  const title = payload.title || payload.mediaTitle || 'Торрент';

  // Previous delete-without-wipe left junk here → WebTorrent freezes on piece verify.
  await wipeOrphanDownloadDir(downloads, payload.title);
  await wipeOrphanDownloadDir(downloads, title);

  const record: TorrentDownloadRecord = {
    id,
    magnet,
    title,
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
  emit();
  await pumpDownloadQueue();
  return { ok: true, torrent: records.find((item) => item.id === id)! };
}

async function destroyActiveTorrent(id: string, deleteFiles = false): Promise<void> {
  clearStallWatchdog(id);
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
    const torrent = client.add(magnet, {
      path: record.savePath || getTorrentsDownloadsDir(),
      deselect: true,
      strategy: 'sequential',
    });
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
  // Incomplete downloads always wipe disk — leftover partials hang the next "Скачать".
  const wipe = Boolean(deleteFiles || (record && isIncompleteRecord(record)));

  if (active) {
    await destroyActiveTorrent(id, wipe);
  }
  if (wipe && record) {
    await wipeRecordDiskData(record);
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
      mediaId?: string;
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
  const episodeTitle = formatPlaybackTitle(baseTitle, preferred.name);

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
    mediaId: record.mediaId,
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

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    void promise.finally(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function destroyTorrentManager(): Promise<void> {
  const activeIds = [...activeTorrents.keys()];
  await Promise.all(
    activeIds.map((id) => withTimeout(destroyActiveTorrent(id, false), 1500)),
  );
  activeTorrents.clear();
  playbackFocusById.clear();

  if (webTorrentServer) {
    try {
      await withTimeout(
        new Promise<void>((resolve) => {
          try {
            webTorrentServer?.destroy(() => resolve());
          } catch {
            resolve();
          }
        }),
        1500,
      );
    } catch {
      // ignore
    }
  }
  webTorrentServer = null;
  webTorrentServerPort = null;

  if (!clientPromise) {
    return;
  }
  try {
    const client = await clientPromise;
    await withTimeout(
      new Promise<void>((resolve) => {
        try {
          client.destroy(() => resolve());
        } catch {
          resolve();
        }
      }),
      2000,
    );
  } catch {
    // ignore
  }
  clientPromise = null;
}
