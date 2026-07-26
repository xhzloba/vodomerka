import { BrowserWindow, ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  type TorrentAddPayload,
  type TorrentDownloadRecord,
} from '../../contracts/ipc';
import {
  addTorrent,
  destroyTorrentManager,
  getTorrentsFolderPath,
  initTorrentManager,
  listTorrents,
  onTorrentsChanged,
  openTorrentFile,
  openTorrentsFolder,
  removeTorrent,
} from '../torrents/manager';
import { ensureTorrentsDirs } from '../torrents/paths';

function broadcast(items: TorrentDownloadRecord[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC_CHANNELS.torrents.changed, items);
  }
}

export function registerTorrentsIpc(): void {
  void ensureTorrentsDirs()
    .then(() => initTorrentManager())
    .catch(() => {
      // folder creation is best-effort at boot
    });

  onTorrentsChanged((items) => {
    broadcast(items);
  });

  ipcMain.handle(IPC_CHANNELS.torrents.list, async () => {
    await initTorrentManager();
    return listTorrents();
  });

  ipcMain.handle(IPC_CHANNELS.torrents.add, async (_event, payload: TorrentAddPayload) =>
    addTorrent(payload),
  );

  ipcMain.handle(
    IPC_CHANNELS.torrents.remove,
    async (_event, id: string, deleteFiles?: boolean) => removeTorrent(id, Boolean(deleteFiles)),
  );

  ipcMain.handle(IPC_CHANNELS.torrents.openFile, async (_event, id: string) => openTorrentFile(id));

  ipcMain.handle(IPC_CHANNELS.torrents.openFolder, async () => openTorrentsFolder());

  ipcMain.handle(IPC_CHANNELS.torrents.getFolderPath, async () => {
    await ensureTorrentsDirs();
    return getTorrentsFolderPath();
  });
}

export async function shutdownTorrentsIpc(): Promise<void> {
  await destroyTorrentManager();
}
