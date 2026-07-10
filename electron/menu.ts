import { Menu, type BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../contracts/ipc';
import { APP_NAME } from './branding';

export function registerAppMenu(getMainWindow: () => BrowserWindow | null) {
  const toggleSidebar = () => {
    getMainWindow()?.webContents.send(IPC_CHANNELS.sidebar.toggle);
  };

  const toggleSearch = () => {
    getMainWindow()?.webContents.send(IPC_CHANNELS.search.toggle);
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Переключить меню',
          accelerator: 'CmdOrCtrl+B',
          click: toggleSidebar,
        },
        {
          label: 'Поиск',
          accelerator: 'CmdOrCtrl+K',
          click: toggleSearch,
        },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
