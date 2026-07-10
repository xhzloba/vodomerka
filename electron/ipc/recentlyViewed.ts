import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import type { StoredMediaItem } from '../db/favorites';
import {
  clearRecentlyViewed,
  listRecentlyViewed,
  trackRecentlyViewed,
} from '../db/recentlyViewed';

function broadcastRecentlyViewedChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.recentlyViewed.changed);
    }
  }
}

export function registerRecentlyViewedIpc() {
  ipcMain.handle(IPC_CHANNELS.recentlyViewed.list, (): StoredMediaItem[] => listRecentlyViewed());

  ipcMain.handle(
    IPC_CHANNELS.recentlyViewed.track,
    (_event, item: StoredMediaItem): StoredMediaItem[] => {
      const next = trackRecentlyViewed(item);
      broadcastRecentlyViewedChanged();
      return next;
    },
  );

  ipcMain.handle(IPC_CHANNELS.recentlyViewed.clear, (): StoredMediaItem[] => {
    const next = clearRecentlyViewed();
    broadcastRecentlyViewedChanged();
    return next;
  });
}
