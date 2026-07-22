import { BrowserWindow, type WebContents } from 'electron';
import path from 'path';
import type { StoredMediaItem } from './db/favorites';
import { getAppSettings, getThemeBackgroundColor } from './db/settings';
import { applyThemeWindowChrome } from './themeChrome';
import { getRendererUrl } from './appUrl';

const detailWindows = new Map<string, BrowserWindow>();
const detailPayloads = new Map<string, StoredMediaItem>();

const DETAIL_WINDOW_MIN_WIDTH = 1024;
const DETAIL_WINDOW_MIN_HEIGHT = 640;
const DETAIL_WINDOW_WIDTH = DETAIL_WINDOW_MIN_WIDTH;
const DETAIL_WINDOW_HEIGHT = DETAIL_WINDOW_MIN_HEIGHT;

export function getDetailPayload(mediaId: string): StoredMediaItem | null {
  return detailPayloads.get(mediaId) ?? null;
}

function revealDetailWindow(mediaId: string): void {
  const win = detailWindows.get(mediaId);
  if (!win || win.isDestroyed()) {
    return;
  }

  if (!win.isVisible()) {
    win.show();
  }

  win.focus();
}

export function notifyDetailWindowReady(mediaId: string): void {
  revealDetailWindow(mediaId);
}

export function tryFocusDetailWindow(mediaId: string): boolean {
  const existing = detailWindows.get(mediaId);
  if (!existing || existing.isDestroyed()) {
    return false;
  }

  if (!existing.isVisible()) {
    existing.show();
  }

  existing.focus();
  return true;
}

export function openDetailWindow(item: StoredMediaItem): void {
  detailPayloads.set(item.id, item);

  const theme = getAppSettings().theme;
  applyThemeWindowChrome(theme);
  const backgroundColor = getThemeBackgroundColor(theme);
  const win = new BrowserWindow({
    width: DETAIL_WINDOW_WIDTH,
    height: DETAIL_WINDOW_HEIGHT,
    minWidth: DETAIL_WINDOW_MIN_WIDTH,
    minHeight: DETAIL_WINDOW_MIN_HEIGHT,
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    backgroundColor,
    title: item.title,
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
    revealDetailWindow(item.id);
  }, 10_000);

  win.once('closed', () => {
    clearTimeout(revealFallbackTimer);
    detailWindows.delete(item.id);
  });

  void win.loadURL(getRendererUrl(`detail/${encodeURIComponent(item.id)}`));

  detailWindows.set(item.id, win);
}

export function closeDetailWindowFromWebContents(webContents: WebContents): void {
  const window = BrowserWindow.fromWebContents(webContents);
  window?.close();
}
