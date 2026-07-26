import { app, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';

const MAC_TRAFFIC_LIGHT_POSITION = {
  expanded: { x: 22, y: 20 },
  collapsed: { x: 20, y: 20 },
} as const;

let playerOverlayOpen = false;
let appQuitting = false;
let getMainWindow: (() => BrowserWindow | null) | null = null;

export function isAppQuitting(): boolean {
  return appQuitting;
}

export function markAppQuitting(): void {
  appQuitting = true;
}

function exitAllFullscreenModes(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return;
  }
  try {
    if (win.isFullScreen()) {
      win.setFullScreen(false);
    }
  } catch {
    // ignore
  }
  if (process.platform === 'darwin') {
    try {
      if (win.isSimpleFullScreen()) {
        win.setSimpleFullScreen(false);
      }
    } catch {
      // ignore
    }
  }
}

/** Soft focus — no Mac Space / workspace flicker. Prefer this when closing the player overlay. */
export function softFocusMainWindow(win: BrowserWindow | null = getMainWindow?.() ?? null): void {
  if (!win || win.isDestroyed()) {
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }
  if (!win.isVisible()) {
    win.show();
  }
  win.focus();
}

/**
 * Жёстко достаёт окно наружу: из minimize / hide / любого fullscreen.
 * Heavy — toggles visibleOnAllWorkspaces on Mac (~400ms flicker). Use only when stuck.
 */
export function forceRevealMainWindow(win: BrowserWindow | null = getMainWindow?.() ?? null): void {
  if (!win || win.isDestroyed()) {
    return;
  }

  exitAllFullscreenModes(win);

  if (win.isMinimized()) {
    win.restore();
  }

  if (process.platform === 'darwin') {
    try {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {
      // ignore
    }
  }

  win.show();
  win.moveTop();
  win.focus();

  if (process.platform === 'darwin') {
    app.focus({ steal: true });
    app.dock?.show();
    setTimeout(() => {
      if (!win.isDestroyed()) {
        try {
          win.setVisibleOnAllWorkspaces(false);
        } catch {
          // ignore
        }
      }
    }, 400);
  }
}

function applyPlayerFullscreen(win: BrowserWindow, fullScreen: boolean): boolean {
  // Не используем setFullScreen / setSimpleFullScreen — на Mac окно теряется.
  exitAllFullscreenModes(win);

  if (fullScreen) {
    if (!win.isMaximized()) {
      win.maximize();
    }
  } else if (win.isMaximized()) {
    win.unmaximize();
  }

  return win.isMaximized();
}

export function registerWindowChromeIpc(getWindow: () => BrowserWindow | null): void {
  getMainWindow = getWindow;

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

  ipcMain.handle(IPC_CHANNELS.windowChrome.setFullScreen, (_event, fullScreen: boolean) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) {
      return false;
    }
    const wantFull = Boolean(fullScreen);
    const wasMaximized = win.isMaximized();
    const applied = applyPlayerFullscreen(win, wantFull);
    if (wantFull) {
      softFocusMainWindow(win);
    } else if (wasMaximized || win.isMinimized() || !win.isVisible()) {
      // Leaving player "fullscreen" (maximize) — soft focus only.
      // forceReveal's workspace toggle was jerking the home UI on every close.
      softFocusMainWindow(win);
    }
    win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, applied);
    return applied;
  });

  ipcMain.handle(IPC_CHANNELS.windowChrome.focusMain, () => {
    softFocusMainWindow(getWindow());
  });

  ipcMain.handle(IPC_CHANNELS.windowChrome.setPlayerOpen, (_event, open: boolean) => {
    playerOverlayOpen = Boolean(open);
    if (open) {
      softFocusMainWindow(getWindow());
    }
  });
}

export function bindMainWindowChrome(win: BrowserWindow): void {
  win.on('enter-full-screen', () => {
    if (playerOverlayOpen) {
      exitAllFullscreenModes(win);
      win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, win.isMaximized());
      forceRevealMainWindow(win);
      return;
    }
    win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, true);
  });
  win.on('leave-full-screen', () => {
    win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, false);
  });
  win.on('enter-html-full-screen', () => {
    if (win.isDestroyed()) {
      return;
    }
    void win.webContents.executeJavaScript(
      'document.fullscreenElement && document.exitFullscreen().catch(() => {})',
    );
  });

  win.on('minimize', () => {
    exitAllFullscreenModes(win);
    win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, false);

    // Пока играет плеер — не даём окну пропасть в никуда.
    if (playerOverlayOpen) {
      setTimeout(() => {
        if (!win.isDestroyed() && playerOverlayOpen) {
          forceRevealMainWindow(win);
        }
      }, 0);
    }
  });

  // Плеер открыт → крестик / Cmd+W закрывают только плеер.
  // Без плеера → полное закрытие приложения (уходит из Dock).
  win.on('close', (event) => {
    if (appQuitting) {
      return;
    }

    if (playerOverlayOpen) {
      event.preventDefault();
      exitAllFullscreenModes(win);
      if (win.isMaximized()) {
        win.unmaximize();
      }
      win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, false);
      win.webContents.send(IPC_CHANNELS.windowChrome.closePlayer);
      softFocusMainWindow(win);
      return;
    }

    markAppQuitting();
    app.quit();
  });
}

export function getMacTrafficLightPosition(collapsed = false): { x: number; y: number } {
  return collapsed ? MAC_TRAFFIC_LIGHT_POSITION.collapsed : MAC_TRAFFIC_LIGHT_POSITION.expanded;
}
