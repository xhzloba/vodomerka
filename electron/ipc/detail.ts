import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import type { StoredMediaItem } from '../db/favorites';
import {
  closeDetailWindowFromWebContents,
  getDetailPayload,
  notifyDetailWindowReady,
  openDetailWindow,
  tryFocusDetailWindow,
} from '../detailWindow';

function broadcastDetailReady(mediaId: string): void {
  notifyDetailWindowReady(mediaId);

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.detail.ready, mediaId);
    }
  }
}

export function registerDetailIpc() {
  ipcMain.handle(IPC_CHANNELS.detail.tryFocus, (_event, mediaId: string): boolean => {
    return typeof mediaId === 'string' && tryFocusDetailWindow(mediaId);
  });

  ipcMain.handle(IPC_CHANNELS.detail.open, (_event, item: StoredMediaItem): void => {
    openDetailWindow(item);
  });

  ipcMain.on(IPC_CHANNELS.detail.ready, (_event, mediaId: string) => {
    if (typeof mediaId === 'string' && mediaId.length > 0) {
      broadcastDetailReady(mediaId);
    }
  });

  ipcMain.handle(IPC_CHANNELS.detail.get, (_event, mediaId: string): StoredMediaItem | null => {
    return getDetailPayload(mediaId);
  });

  ipcMain.handle(IPC_CHANNELS.detail.close, (event): void => {
    closeDetailWindowFromWebContents(event.sender);
  });
}
