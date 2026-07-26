import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS, type ContinueWatchingUpsertPayload } from '../../contracts/ipc';
import {
  clearContinueWatching,
  listContinueWatching,
  removeContinueWatching,
  upsertContinueWatching,
} from '../db/continueWatching';

function broadcastContinueWatchingChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.continueWatching.changed);
    }
  }
}

export function registerContinueWatchingIpc() {
  ipcMain.handle(IPC_CHANNELS.continueWatching.list, () => listContinueWatching());

  ipcMain.handle(
    IPC_CHANNELS.continueWatching.upsert,
    (_event, payload: ContinueWatchingUpsertPayload) => {
      if (!payload?.item?.id || !payload.item.title) {
        return listContinueWatching();
      }
      const next = upsertContinueWatching({
        mediaId: payload.mediaId,
        item: payload.item,
        torrentId: payload.torrentId,
        filePath: payload.filePath,
        positionSeconds: payload.positionSeconds,
        durationSeconds: payload.durationSeconds,
      });
      broadcastContinueWatchingChanged();
      return next;
    },
  );

  ipcMain.handle(IPC_CHANNELS.continueWatching.remove, (_event, id: string) => {
    const next = removeContinueWatching(id);
    broadcastContinueWatchingChanged();
    return next;
  });

  ipcMain.handle(IPC_CHANNELS.continueWatching.clear, () => {
    const next = clearContinueWatching();
    broadcastContinueWatchingChanged();
    return next;
  });
}
