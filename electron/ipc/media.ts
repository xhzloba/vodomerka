import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import { prepareTorrentPlayback } from '../media/playback';
import { shutdownMediaServer, stopActivePlayback } from '../media/server';
import { cancelBackgroundRemuxJobs } from '../media/remux';

export function registerMediaIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.media.prepareTorrentPlayback,
    async (_event, torrentId: string, filePath?: string | null) => {
      if (typeof torrentId !== 'string' || !torrentId.trim()) {
        return { ok: false, error: 'Некорректный id' };
      }
      const resolvedPath =
        typeof filePath === 'string' && filePath.trim() ? filePath.trim() : undefined;
      return prepareTorrentPlayback(torrentId.trim(), resolvedPath);
    },
  );

  ipcMain.handle(IPC_CHANNELS.media.stopPlayback, async () => {
    stopActivePlayback();
    cancelBackgroundRemuxJobs();
  });
}

export async function shutdownMediaIpc(): Promise<void> {
  cancelBackgroundRemuxJobs();
  await shutdownMediaServer();
}
