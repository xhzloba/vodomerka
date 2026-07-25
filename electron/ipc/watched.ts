import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS, type StoredMediaItem, type WatchStatus } from '../../contracts/ipc';
import {
  clearWatchStatuses,
  getWatchStatus,
  listWatchStatuses,
  removeWatchStatus,
  setWatchStatus,
} from '../db/watched';

function broadcastWatchedChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.watched.changed);
    }
  }
}

export function registerWatchedIpc() {
  ipcMain.handle(IPC_CHANNELS.watched.list, () => listWatchStatuses());

  ipcMain.handle(
    IPC_CHANNELS.watched.setStatus,
    (_event, item: StoredMediaItem, status: WatchStatus) => {
      const next = setWatchStatus(item, status);
      broadcastWatchedChanged();
      return next;
    },
  );

  ipcMain.handle(IPC_CHANNELS.watched.remove, (_event, mediaId: string) => {
    const next = removeWatchStatus(mediaId);
    broadcastWatchedChanged();
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.watched.getStatus, (_event, mediaId: string) =>
    getWatchStatus(mediaId),
  );

  ipcMain.handle(IPC_CHANNELS.watched.clear, (_event, status?: WatchStatus) => {
    const next = clearWatchStatuses(status);
    broadcastWatchedChanged();
    return next;
  });
}
