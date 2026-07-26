import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import { prepareTorrentPlayback } from '../media/playback';
import { shutdownMediaServer } from '../media/server';

export function registerMediaIpc(): void {
  ipcMain.handle(IPC_CHANNELS.media.prepareTorrentPlayback, async (_event, torrentId: string) => {
    if (typeof torrentId !== 'string' || !torrentId.trim()) {
      return { ok: false, error: 'Некорректный id' };
    }
    return prepareTorrentPlayback(torrentId.trim());
  });
}

export async function shutdownMediaIpc(): Promise<void> {
  await shutdownMediaServer();
}
