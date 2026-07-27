import { BrowserWindow, ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  type TorrentAddPayload,
  type TorrentDownloadRecord,
} from '../../contracts/ipc';
import {
  addTorrent,
  backfillMissingMediaTypes,
  destroyTorrentManager,
  getTorrentsFolderPath,
  initTorrentManager,
  listTorrents,
  onTorrentsChanged,
  openTorrentFile,
  openTorrentInPlayer,
  openTorrentsFolder,
  pauseTorrent,
  removeTorrent,
  resumeTorrentDownload,
  setTorrentMediaType,
} from '../torrents/manager';
import { ensureTorrentsDirs } from '../torrents/paths';
import { probeTorrentConnectivity } from '../torrents/probeConnectivity';
import {
  removeContinueWatchingByTorrentId,
  removeOrphanContinueWatchingTorrents,
} from '../db/continueWatching';
import { broadcastContinueWatchingChanged } from './continueWatching';

function broadcast(items: TorrentDownloadRecord[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC_CHANNELS.torrents.changed, items);
  }
}

export function registerTorrentsIpc(): void {
  void ensureTorrentsDirs()
    .then(() => initTorrentManager())
    .then(() => {
      // One-time sweep: continue-watching rows whose torrent was deleted earlier.
      const validIds = listTorrents().map((item) => item.id);
      if (removeOrphanContinueWatchingTorrents(validIds) > 0) {
        broadcastContinueWatchingChanged();
      }
    })
    .catch(() => {
      // folder creation is best-effort at boot
    });

  onTorrentsChanged((items) => {
    broadcast(items);
  });

  ipcMain.handle(IPC_CHANNELS.torrents.list, async () => {
    await initTorrentManager();
    await backfillMissingMediaTypes();
    return listTorrents();
  });

  ipcMain.handle(
    IPC_CHANNELS.torrents.setMediaType,
    async (_event, id: string, mediaType: string) => {
      if (typeof id !== 'string' || !id.trim() || typeof mediaType !== 'string') {
        return listTorrents();
      }
      return setTorrentMediaType(id.trim(), mediaType);
    },
  );

  ipcMain.handle(IPC_CHANNELS.torrents.add, async (_event, payload: TorrentAddPayload) =>
    addTorrent(payload),
  );

  ipcMain.handle(
    IPC_CHANNELS.torrents.remove,
    async (_event, id: string, deleteFiles?: boolean) => {
      const next = await removeTorrent(id, Boolean(deleteFiles));
      // Resume entries for a deleted torrent point at nothing — drop them from «Продолжить просмотр».
      try {
        if (removeContinueWatchingByTorrentId(id) > 0) {
          broadcastContinueWatchingChanged();
        }
      } catch {
        // best-effort cleanup
      }
      return next;
    },
  );

  ipcMain.handle(IPC_CHANNELS.torrents.pause, async (_event, id: string) => {
    if (typeof id !== 'string' || !id.trim()) {
      return listTorrents();
    }
    return pauseTorrent(id.trim());
  });

  ipcMain.handle(IPC_CHANNELS.torrents.resume, async (_event, id: string) => {
    if (typeof id !== 'string' || !id.trim()) {
      return listTorrents();
    }
    return resumeTorrentDownload(id.trim());
  });

  ipcMain.handle(IPC_CHANNELS.torrents.openFile, async (_event, id: string, filePath?: string) =>
    openTorrentFile(id, typeof filePath === 'string' ? filePath : undefined),
  );

  ipcMain.handle(
    IPC_CHANNELS.torrents.openInPlayer,
    async (_event, id: string, playerId: string, filePath?: string) =>
      openTorrentInPlayer(
        id,
        playerId,
        typeof filePath === 'string' && filePath.trim() ? filePath.trim() : undefined,
      ),
  );

  ipcMain.handle(IPC_CHANNELS.torrents.openFolder, async () => openTorrentsFolder());

  ipcMain.handle(IPC_CHANNELS.torrents.getFolderPath, async () => {
    await ensureTorrentsDirs();
    return getTorrentsFolderPath();
  });

  ipcMain.handle(IPC_CHANNELS.torrents.probeConnectivity, async () => probeTorrentConnectivity());
}

export async function shutdownTorrentsIpc(): Promise<void> {
  await destroyTorrentManager();
}
