import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import type {
  TorrentAddPayload,
  TorrentAddResult,
  TorrentDownloadFile,
  TorrentDownloadRecord,
} from '../../contracts/ipc';
import { ensureTorrentsDirs, getTorrentsDownloadsDir, getTorrentsRoot } from './paths';
import { loadTorrentState, saveTorrentState } from './store';

type WebTorrentClient = {
  add: (
    magnet: string,
    opts: { path: string },
    cb?: (torrent: WebTorrentTorrent) => void,
  ) => WebTorrentTorrent;
  get: (id: string) => WebTorrentTorrent | undefined;
  remove: (id: string, opts?: { destroyStore?: boolean }, cb?: (err?: Error | string) => void) => void;
  destroy: (cb?: (err?: Error) => void) => void;
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
  files: Array<{ name: string; path: string; length: number }>;
  path: string;
  destroy: (opts?: { destroyStore?: boolean }, cb?: (err?: Error | string) => void) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

let clientPromise: Promise<WebTorrentClient> | null = null;
let records: TorrentDownloadRecord[] = [];
let ready = false;
const listeners = new Set<(items: TorrentDownloadRecord[]) => void>();
const activeTorrents = new Map<string, WebTorrentTorrent>();

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

  const syncProgress = () => {
    const done = Boolean(torrent.done) || torrent.progress >= 0.999;
    patchRecord(id, {
      title: torrent.name || records.find((item) => item.id === id)?.title || 'Торрент',
      progress: Math.min(1, Math.max(0, torrent.progress || 0)),
      downloadSpeed: torrent.downloadSpeed || 0,
      uploaded: torrent.uploaded || 0,
      downloaded: torrent.downloaded || 0,
      length: torrent.length || 0,
      status: done ? 'done' : 'downloading',
      files: mapFiles(torrent),
      savePath: torrent.path || getTorrentsDownloadsDir(),
      error: undefined,
    });
    void persist();
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
    const torrent = client.add(payload.magnet, { path: downloads });
    patchRecord(id, { status: 'downloading' });
    await persist();
    bindTorrent(id, torrent);
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
  const torrent = client.add(record.magnet, { path: record.savePath || getTorrentsDownloadsDir() });
  patchRecord(id, { status: 'downloading', error: undefined });
  await persist();
  bindTorrent(id, torrent);
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

export async function openTorrentFile(id: string): Promise<{ ok: boolean; error?: string }> {
  const record = records.find((item) => item.id === id);
  if (!record) {
    return { ok: false, error: 'Торрент не найден' };
  }

  const videoExt = /\.(mkv|mp4|avi|mov|wmv|m4v|webm|ts)$/i;
  const preferred =
    record.files.find((file) => videoExt.test(file.name)) ??
    [...record.files].sort((a, b) => b.length - a.length)[0];

  const target = preferred?.path || record.savePath;
  if (!target) {
    return { ok: false, error: 'Файл ещё не готов' };
  }

  const result = await shell.openPath(target);
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
