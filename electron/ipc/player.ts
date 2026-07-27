import { BrowserWindow, ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  type PlayerOpenTorrentPayload,
  type PlayerOpenTorrentResult,
} from '../../contracts/ipc';
import { prepareTorrentPlayback } from '../media/playback';
import {
  closePlayerWindowFromWebContents,
  getPlayerPayload,
  notifyPlayerWindowReady,
  openPlayerWindow,
} from '../playerWindow';

function broadcastPlayerReady(): void {
  notifyPlayerWindowReady();

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.player.ready);
    }
  }
}

export function registerPlayerIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.player.openTorrent,
    async (_event, payload: PlayerOpenTorrentPayload): Promise<PlayerOpenTorrentResult> => {
      if (!payload || typeof payload.torrentId !== 'string' || !payload.torrentId.trim()) {
        return { ok: false, error: 'Некорректный id' };
      }

      const torrentId = payload.torrentId.trim();
      const filePath =
        typeof payload.filePath === 'string' && payload.filePath.trim()
          ? payload.filePath.trim()
          : undefined;

      const prepared = await prepareTorrentPlayback(torrentId, filePath);
      if (!prepared.ok) {
        return prepared;
      }

      const startSeconds =
        typeof payload.startSeconds === 'number' &&
        Number.isFinite(payload.startSeconds) &&
        payload.startSeconds > 0
          ? payload.startSeconds
          : undefined;

      const session =
        startSeconds != null
          ? { ...prepared.session, startSeconds }
          : prepared.session;

      openPlayerWindow(session);
      return { ok: true };
    },
  );

  ipcMain.handle(IPC_CHANNELS.player.get, () => getPlayerPayload());

  ipcMain.handle(IPC_CHANNELS.player.close, (event) => {
    closePlayerWindowFromWebContents(event.sender);
  });

  ipcMain.on(IPC_CHANNELS.player.ready, () => {
    broadcastPlayerReady();
  });
}
