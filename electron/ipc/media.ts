import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import { prepareTorrentPlayback } from '../media/playback';
import { shutdownMediaServer, stopActivePlayback } from '../media/server';
import { cancelBackgroundRemuxJobs } from '../media/remux';

export function registerMediaIpc(): void {
  ipcMain.handle(IPC_CHANNELS.media.prepareTorrentPlayback, async (_event, torrentId: string) => {
    if (typeof torrentId !== 'string' || !torrentId.trim()) {
      return { ok: false, error: 'Некорректный id' };
    }
    return prepareTorrentPlayback(torrentId.trim());
  });

  ipcMain.handle(IPC_CHANNELS.media.stopPlayback, async () => {
    stopActivePlayback();
    cancelBackgroundRemuxJobs();
  });
}

export async function shutdownMediaIpc(): Promise<void> {
  cancelBackgroundRemuxJobs();
  await shutdownMediaServer();
}
