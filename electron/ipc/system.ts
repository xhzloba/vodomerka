import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';
import { getSystemUserDisplayName } from '../system/userDisplayName';

export function registerSystemIpc(): void {
  ipcMain.handle(IPC_CHANNELS.system.getUserDisplayName, () => getSystemUserDisplayName());
}
