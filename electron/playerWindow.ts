import { BrowserWindow, type WebContents } from 'electron';
import path from 'path';
import type { MediaPlaybackSession } from '../contracts/ipc';
import { IPC_CHANNELS } from '../contracts/ipc';
import { getAppSettings, getThemeBackgroundColor } from './db/settings';
import { applyThemeWindowChrome } from './themeChrome';
import { getRendererUrl } from './appUrl';
import { softFocusMainWindow } from './ipc/windowChrome';
import { stopActivePlayback } from './media/server';
import { cancelBackgroundRemuxJobs } from './media/remux';

let playerWindow: BrowserWindow | null = null;
let playerPayload: MediaPlaybackSession | null = null;

const PLAYER_WINDOW_MIN_WIDTH = 960;
const PLAYER_WINDOW_MIN_HEIGHT = 540;
const PLAYER_WINDOW_WIDTH = 1280;
const PLAYER_WINDOW_HEIGHT = 720;

export function getPlayerPayload(): MediaPlaybackSession | null {
  return playerPayload;
}

export function hasPlayerWindow(): boolean {
  return Boolean(playerWindow && !playerWindow.isDestroyed());
}

function revealPlayerWindow(): void {
  const win = playerWindow;
  if (!win || win.isDestroyed()) {
    return;
  }

  if (!win.isVisible()) {
    win.show();
  }

  win.focus();
}

export function notifyPlayerWindowReady(): void {
  revealPlayerWindow();
}

export function tryFocusPlayerWindow(): boolean {
  if (!hasPlayerWindow()) {
    return false;
  }
  revealPlayerWindow();
  return true;
}

function pushSessionToPlayerWindow(session: MediaPlaybackSession): void {
  const win = playerWindow;
  if (!win || win.isDestroyed()) {
    return;
  }
  win.setTitle(session.title || 'Vodomerka Player');
  win.webContents.send(IPC_CHANNELS.player.session, session);
  revealPlayerWindow();
}

export function openPlayerWindow(session: MediaPlaybackSession): void {
  playerPayload = session;

  if (hasPlayerWindow()) {
    pushSessionToPlayerWindow(session);
    return;
  }

  const theme = getAppSettings().theme;
  applyThemeWindowChrome(theme);
  const backgroundColor = getThemeBackgroundColor(theme);
  const win = new BrowserWindow({
    width: PLAYER_WINDOW_WIDTH,
    height: PLAYER_WINDOW_HEIGHT,
    minWidth: PLAYER_WINDOW_MIN_WIDTH,
    minHeight: PLAYER_WINDOW_MIN_HEIGHT,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    backgroundColor,
    title: session.title || 'Vodomerka Player',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  win.once('ready-to-show', () => {
    win.setBackgroundColor(getThemeBackgroundColor(getAppSettings().theme));
  });

  const revealFallbackTimer = setTimeout(() => {
    revealPlayerWindow();
  }, 10_000);

  win.on('closed', () => {
    clearTimeout(revealFallbackTimer);
    playerWindow = null;
    playerPayload = null;
    stopActivePlayback();
    cancelBackgroundRemuxJobs();
    // Return focus to main — home stays open underneath the player window.
    softFocusMainWindow();
  });

  void win.loadURL(getRendererUrl('player'));
  playerWindow = win;
}

export function closePlayerWindowFromWebContents(webContents: WebContents): void {
  const window = BrowserWindow.fromWebContents(webContents);
  if (!window || window.isDestroyed()) {
    return;
  }
  if (playerWindow === window) {
    window.close();
  }
}

export function closePlayerWindow(): void {
  if (!playerWindow || playerWindow.isDestroyed()) {
    playerWindow = null;
    playerPayload = null;
    return;
  }
  playerWindow.close();
}
