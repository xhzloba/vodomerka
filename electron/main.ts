import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { closeDatabase } from './db/database';
import { getAppSettings, getThemeBackgroundColor } from './db/settings';
import { applyThemeWindowChrome } from './themeChrome';
import { registerApiIpc } from './ipc/api';
import { registerFavoritesIpc } from './ipc/favorites';
import { registerRecentlyViewedIpc } from './ipc/recentlyViewed';
import { registerContinueWatchingIpc } from './ipc/continueWatching';
import { registerWatchedIpc } from './ipc/watched';
import { registerImagesIpc } from './ipc/images';
import { registerOverridesIpc } from './ipc/overrides';
import { registerSettingsIpc } from './ipc/settings';
import { registerBackupIpc } from './ipc/backup';
import { registerPluginsIpc } from './ipc/plugins';
import { registerAiIpc } from './ipc/ai';
import { registerDetailIpc } from './ipc/detail';
import { registerPlayerIpc } from './ipc/player';
import { configureAppBranding, APP_NAME } from './branding';
import { registerAppMenu } from './menu';
import {
  registerWindowChromeIpc,
  getMacTrafficLightPosition,
  bindMainWindowChrome,
  markAppQuitting,
  softFocusMainWindow,
} from './ipc/windowChrome';
import { registerSystemIpc } from './ipc/system';
import { registerTorrentsIpc, shutdownTorrentsIpc } from './ipc/torrents';
import { registerMediaIpc, shutdownMediaIpc } from './ipc/media';

if (process.platform === 'darwin') {
  app.setName(APP_NAME);
}

// Suppress Electron's blocking error dialog; log instead so vite can restart cleanly.
process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection', reason);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let isShuttingDown = false;

const MAIN_WINDOW_MIN_WIDTH = 1280;
const MAIN_WINDOW_MIN_HEIGHT = 840;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  // softFocus — Dock activate / second-instance. forceReveal's workspace toggle jerks the UI.
  softFocusMainWindow(mainWindow);
}

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
  applyThemeWindowChrome(initialSettings.theme);
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
    bindMainWindowChrome(mainWindow);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.setBackgroundColor(getThemeBackgroundColor(getAppSettings().theme));
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

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  focusMainWindow();
});

app.whenReady().then(() => {
  configureAppBranding();
  registerSettingsIpc(() => mainWindow);
  registerBackupIpc();
  registerPluginsIpc(() => mainWindow);
  registerAiIpc();
  registerFavoritesIpc();
  registerRecentlyViewedIpc();
  registerContinueWatchingIpc();
  registerWatchedIpc();
  registerApiIpc();
  registerImagesIpc();
  registerOverridesIpc();
  registerDetailIpc();
  registerPlayerIpc();
  registerWindowChromeIpc(() => mainWindow);
  registerSystemIpc();
  registerTorrentsIpc();
  registerMediaIpc();
  registerAppMenu(() => mainWindow);
  createWindow();
});

app.on('before-quit', (event) => {
  if (isShuttingDown) {
    return;
  }
  // Await WebTorrent/ffmpeg teardown — otherwise the process stays alive after the window closes.
  event.preventDefault();
  isShuttingDown = true;
  markAppQuitting();

  const forceTimer = setTimeout(() => {
    console.warn('[main] shutdown timed out, forcing exit');
    app.exit(0);
  }, 4000);

  void Promise.allSettled([shutdownMediaIpc(), shutdownTorrentsIpc()])
    .catch((error) => {
      console.warn('[main] shutdown failed', error);
    })
    .finally(() => {
      clearTimeout(forceTimer);
      try {
        closeDatabase();
      } catch {
        // ignore
      }
      app.exit(0);
    });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (isShuttingDown) {
    return;
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  focusMainWindow();
});
