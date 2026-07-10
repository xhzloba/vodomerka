import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';

const MAC_TRAFFIC_LIGHT_POSITION = {
  expanded: { x: 22, y: 16 },
  collapsed: { x: 16, y: 16 },
} as const;

export function registerWindowChromeIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.windowChrome.setSidebarCollapsed, (_event, collapsed: boolean) => {
    if (process.platform !== 'darwin') {
      return;
    }

    const win = getWindow();
    if (!win) {
      return;
    }

    win.setWindowButtonPosition(
      collapsed ? MAC_TRAFFIC_LIGHT_POSITION.collapsed : MAC_TRAFFIC_LIGHT_POSITION.expanded,
    );
  });
}

export function getMacTrafficLightPosition(collapsed = false): { x: number; y: number } {
  return collapsed ? MAC_TRAFFIC_LIGHT_POSITION.collapsed : MAC_TRAFFIC_LIGHT_POSITION.expanded;
}
