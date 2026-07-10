import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import {
  addFavorite,
  clearAllFavorites,
  hasFavorite,
  listFavorites,
  removeFavorite,
  type StoredMediaItem,
} from '../db/favorites';

function broadcastFavoritesChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.favorites.changed);
    }
  }
}

export function registerFavoritesIpc() {
  ipcMain.handle(IPC_CHANNELS.favorites.list, (): StoredMediaItem[] => listFavorites());

  ipcMain.handle(IPC_CHANNELS.favorites.add, (_event, item: StoredMediaItem): StoredMediaItem[] => {
    const next = addFavorite(item);
    broadcastFavoritesChanged();
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.favorites.remove, (_event, mediaId: string): StoredMediaItem[] => {
    const next = removeFavorite(mediaId);
    broadcastFavoritesChanged();
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.favorites.has, (_event, mediaId: string): boolean => hasFavorite(mediaId));

  ipcMain.handle(IPC_CHANNELS.favorites.clear, (): StoredMediaItem[] => {
    const next = clearAllFavorites();
    broadcastFavoritesChanged();
    return next;
  });
}
