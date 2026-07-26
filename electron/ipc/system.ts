import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';
import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS, type OpenExternalResult } from '../../contracts/ipc';
import { getSystemUserDisplayName } from '../system/userDisplayName';

const execFileAsync = promisify(execFile);

/** VLC magnet не умеет — нужны торрент-клиенты. */
const MAC_TORRENT_APPS = [
  '/Applications/Transmission.app',
  `${process.env.HOME ?? ''}/Applications/Transmission.app`,
  '/Applications/qBittorrent.app',
  `${process.env.HOME ?? ''}/Applications/qBittorrent.app`,
  '/Applications/Folx.app',
  `${process.env.HOME ?? ''}/Applications/Folx.app`,
  '/Applications/Progressive Downloader.app',
  `${process.env.HOME ?? ''}/Applications/Progressive Downloader.app`,
  '/Applications/Free Download Manager.app',
  `${process.env.HOME ?? ''}/Applications/Free Download Manager.app`,
];

const WIN_TORRENT_EXES = [
  `${process.env.LOCALAPPDATA ?? ''}\\qBittorrent\\qbittorrent.exe`,
  `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\qBittorrent\\qbittorrent.exe`,
  `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\qBittorrent\\qbittorrent.exe`,
  `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\Transmission\\transmission-qt.exe`,
];

function isAllowedExternalUrl(url: string): boolean {
  return (
    url.startsWith('magnet:') ||
    url.startsWith('http://') ||
    url.startsWith('https://')
  );
}

async function pathExists(path: string): Promise<boolean> {
  if (!path) {
    return false;
  }
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function openMagnetWithKnownClient(magnet: string): Promise<string | null> {
  if (process.platform === 'darwin') {
    for (const appPath of MAC_TORRENT_APPS) {
      if (!(await pathExists(appPath))) {
        continue;
      }
      try {
        await execFileAsync('open', ['-a', appPath, magnet]);
        return appPath.split('/').pop()?.replace(/\.app$/, '') ?? 'torrent';
      } catch {
        // try next
      }
    }
    return null;
  }

  if (process.platform === 'win32') {
    for (const exePath of WIN_TORRENT_EXES) {
      if (!(await pathExists(exePath))) {
        continue;
      }
      try {
        await execFileAsync(exePath, [magnet], { windowsHide: true });
        return 'torrent';
      } catch {
        // try next
      }
    }
    return null;
  }

  for (const bin of ['transmission-gtk', 'transmission-qt', 'qbittorrent']) {
    try {
      await execFileAsync(bin, [magnet]);
      return bin;
    } catch {
      // try next
    }
  }
  return null;
}

async function openExternalUrl(url: string): Promise<OpenExternalResult> {
  if (!isAllowedExternalUrl(url)) {
    return { ok: false, error: 'Неподдерживаемый URL' };
  }

  if (url.startsWith('magnet:')) {
    // 1) системный обработчик magnet:
    try {
      await shell.openExternal(url);
      return { ok: true, via: 'system' };
    } catch {
      // fall through to known clients
    }

    // 2) известные торрент-клиенты (VLC намеренно не трогаем — magnet не открывает)
    const via = await openMagnetWithKnownClient(url);
    if (via) {
      return { ok: true, via };
    }

    return {
      ok: false,
      error:
        'Нет приложения для magnet. Поставь Transmission / qBittorrent и назначь его для magnet-ссылок',
    };
  }

  try {
    await shell.openExternal(url);
    return { ok: true, via: 'system' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось открыть ссылку';
    return { ok: false, error: message };
  }
}

import { listInstalledMediaPlayers } from '../media/players';

export function registerSystemIpc(): void {
  ipcMain.handle(IPC_CHANNELS.system.getUserDisplayName, () => getSystemUserDisplayName());
  ipcMain.handle(
    IPC_CHANNELS.system.openExternal,
    async (_event, url: string): Promise<OpenExternalResult> => openExternalUrl(url),
  );
  ipcMain.handle(IPC_CHANNELS.system.listMediaPlayers, async () => listInstalledMediaPlayers());
}
