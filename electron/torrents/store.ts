import { readFile, writeFile } from 'node:fs/promises';
import type { TorrentDownloadRecord } from '../../contracts/ipc';
import { ensureTorrentsDirs, getTorrentsStatePath } from './paths';

export async function loadTorrentState(): Promise<TorrentDownloadRecord[]> {
  await ensureTorrentsDirs();
  try {
    const raw = await readFile(getTorrentsStatePath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isTorrentRecord);
  } catch {
    return [];
  }
}

export async function saveTorrentState(items: TorrentDownloadRecord[]): Promise<void> {
  await ensureTorrentsDirs();
  await writeFile(getTorrentsStatePath(), JSON.stringify(items, null, 2), 'utf8');
}

function isTorrentRecord(value: unknown): value is TorrentDownloadRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<TorrentDownloadRecord>;
  return (
    typeof record.id === 'string' &&
    typeof record.magnet === 'string' &&
    typeof record.title === 'string' &&
    typeof record.status === 'string' &&
    typeof record.progress === 'number'
  );
}
