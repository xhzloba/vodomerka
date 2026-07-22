import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import type { AppSettings } from '../db/settings';
import { getAppSettings, resetAppDatabase, updateAppSettings } from '../db/settings';
import { applyThemeWindowChrome } from '../themeChrome';

export function registerSettingsIpc(_getWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC_CHANNELS.settings.get, (): AppSettings => getAppSettings());

  ipcMain.handle(IPC_CHANNELS.settings.set, (_event, patch: Partial<AppSettings>): AppSettings => {
    const next = updateAppSettings(patch);

    if (patch.theme !== undefined) {
      applyThemeWindowChrome(next.theme);
    }

    return next;
  });

  ipcMain.handle(IPC_CHANNELS.settings.reset, (): AppSettings => {
    const next = resetAppDatabase();
    applyThemeWindowChrome(next.theme);
    return next;
  });
}
