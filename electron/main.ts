import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { closeDatabase } from './db/database';
import { getAppSettings, getThemeBackgroundColor } from './db/settings';
import { registerApiIpc } from './ipc/api';
import { registerFavoritesIpc } from './ipc/favorites';
import { registerRecentlyViewedIpc } from './ipc/recentlyViewed';
import { registerWatchedIpc } from './ipc/watched';
import { registerImagesIpc } from './ipc/images';
import { registerOverridesIpc } from './ipc/overrides';
import { registerSettingsIpc } from './ipc/settings';
import { registerBackupIpc } from './ipc/backup';
import { registerPluginsIpc } from './ipc/plugins';
import { registerDetailIpc } from './ipc/detail';
import { configureAppBranding, APP_NAME } from './branding';
import { registerAppMenu } from './menu';
import { registerWindowChromeIpc, getMacTrafficLightPosition } from './ipc/windowChrome';
import { registerSystemIpc } from './ipc/system';

if (process.platform === 'darwin') {
  app.setName(APP_NAME);
}

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

const MAIN_WINDOW_MIN_WIDTH = 1280;
const MAIN_WINDOW_MIN_HEIGHT = 840;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function applyWindowTitle(win: BrowserWindow): void {
  win.setTitle(APP_NAME);
}

function bindWindowTitle(win: BrowserWindow): void {
  win.on('page-title-updated', (event) => {
    event.preventDefault();
    applyWindowTitle(win);
  });

  win.webContents.on('did-finish-load', () => {
    applyWindowTitle(win);
  });
}

function createWindow() {
  const initialSettings = getAppSettings();
  const initialBackground = getThemeBackgroundColor(initialSettings.theme);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    backgroundColor: initialBackground,
    title: APP_NAME,
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: getMacTrafficLightPosition(false),
        }
      : {}),
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
    show: false,
  });

  if (mainWindow) {
    bindWindowTitle(mainWindow);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('will-resize', () => {
    const settings = getAppSettings();
    mainWindow?.setBackgroundColor(getThemeBackgroundColor(settings.theme));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  configureAppBranding();
  registerSettingsIpc(() => mainWindow);
  registerBackupIpc();
  registerPluginsIpc(() => mainWindow);
  registerFavoritesIpc();
  registerRecentlyViewedIpc();
  registerWatchedIpc();
  registerApiIpc();
  registerImagesIpc();
  registerOverridesIpc();
  registerDetailIpc();
  registerWindowChromeIpc(() => mainWindow);
  registerSystemIpc();
  registerAppMenu(() => mainWindow);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  closeDatabase();
});
