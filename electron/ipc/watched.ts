import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import {
  addWatched,
  clearAllWatched,
  hasWatched,
  listWatched,
  removeWatched,
  type StoredMediaItem,
} from '../db/watched';

function broadcastWatchedChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.watched.changed);
    }
  }
}

export function registerWatchedIpc() {
  ipcMain.handle(IPC_CHANNELS.watched.list, (): StoredMediaItem[] => listWatched());

  ipcMain.handle(IPC_CHANNELS.watched.add, (_event, item: StoredMediaItem): StoredMediaItem[] => {
    const next = addWatched(item);
    broadcastWatchedChanged();
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.watched.remove, (_event, mediaId: string): StoredMediaItem[] => {
    const next = removeWatched(mediaId);
    broadcastWatchedChanged();
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.watched.has, (_event, mediaId: string): boolean => hasWatched(mediaId));

  ipcMain.handle(IPC_CHANNELS.watched.clear, (): StoredMediaItem[] => {
    const next = clearAllWatched();
    broadcastWatchedChanged();
    return next;
  });
}
