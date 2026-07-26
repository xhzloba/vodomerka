import { app } from 'electron';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export function getTorrentsRoot(): string {
  return path.join(app.getPath('userData'), 'Torrents');
}

export function getTorrentsDownloadsDir(): string {
  return path.join(getTorrentsRoot(), 'Downloads');
}

export function getTorrentsStatePath(): string {
  return path.join(getTorrentsRoot(), 'state.json');
}

export async function ensureTorrentsDirs(): Promise<{ root: string; downloads: string }> {
  const root = getTorrentsRoot();
  const downloads = getTorrentsDownloadsDir();
  await mkdir(root, { recursive: true });
  await mkdir(downloads, { recursive: true });
  return { root, downloads };
}
