import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS, type AppSettings } from '../../contracts/ipc';
import { exportAppDatabase, importAppDatabase, type BackupResult } from '../db/backup';

function broadcastCollectionsChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }

    window.webContents.send(IPC_CHANNELS.favorites.changed);
    window.webContents.send(IPC_CHANNELS.recentlyViewed.changed);
    window.webContents.send(IPC_CHANNELS.watched.changed);
  }
}

export function registerBackupIpc() {
  ipcMain.handle(IPC_CHANNELS.backup.export, async (): Promise<BackupResult> => exportAppDatabase());

  ipcMain.handle(
    IPC_CHANNELS.backup.import,
    async (): Promise<BackupResult & { settings?: AppSettings }> => {
      const result = await importAppDatabase();
      if (result.ok) {
        broadcastCollectionsChanged();
      }
      return result;
    },
  );
}
