import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import {
  fetchThemeCatalog,
  getInstalledTheme,
  installTheme,
  listInstalledThemes,
  uninstallTheme,
} from '../plugins/themes';
import { getAppSettings, getThemeBackgroundColor, updateAppSettings } from '../db/settings';
import { DEFAULT_THEME_ID } from '../../contracts/themes';

export function registerPluginsIpc(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC_CHANNELS.plugins.listThemes, () => listInstalledThemes());

  ipcMain.handle(IPC_CHANNELS.plugins.getTheme, (_event, id: string) => getInstalledTheme(id));

  ipcMain.handle(IPC_CHANNELS.plugins.installTheme, (_event, urlOrLocalId: string) =>
    installTheme(urlOrLocalId),
  );

  ipcMain.handle(IPC_CHANNELS.plugins.uninstallTheme, async (_event, id: string) => {
    const result = await uninstallTheme(id);
    if (result.ok) {
      const settings = getAppSettings();
      if (settings.theme === id) {
        const next = updateAppSettings({ theme: DEFAULT_THEME_ID });
        getWindow()?.setBackgroundColor(getThemeBackgroundColor(next.theme));
      }
    }
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.plugins.fetchCatalog, () => fetchThemeCatalog());
}
