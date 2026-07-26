import { app, ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../contracts/ipc';

const MAC_TRAFFIC_LIGHT_POSITION = {
  expanded: { x: 22, y: 20 },
  collapsed: { x: 20, y: 20 },
} as const;

let playerOverlayOpen = false;
let isAppQuitting = false;

function isWindowFullscreen(win: BrowserWindow): boolean {
  if (process.platform === 'darwin') {
    return win.isSimpleFullScreen() || win.isFullScreen();
  }
  return win.isFullScreen();
}

function applyFullscreen(win: BrowserWindow, fullScreen: boolean): boolean {
  // На Mac native setFullScreen уводит окно в отдельный Space — «пропадает».
  // simpleFullScreen остаётся на том же рабочем столе.
  if (process.platform === 'darwin') {
    if (win.isFullScreen()) {
      win.setFullScreen(false);
    }
    win.setSimpleFullScreen(Boolean(fullScreen));
    return win.isSimpleFullScreen();
  }

  win.setFullScreen(Boolean(fullScreen));
  return win.isFullScreen();
}

function restoreAndFocus(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return;
  }
  if (isWindowFullscreen(win)) {
    applyFullscreen(win, false);
  }
  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.focus();
}

export function registerWindowChromeIpc(getWindow: () => BrowserWindow | null): void {
  app.on('before-quit', () => {
    isAppQuitting = true;
  });

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
    const applied = applyFullscreen(win, Boolean(fullScreen));
    if (!fullScreen) {
      restoreAndFocus(win);
    }
    win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, applied);
    return applied;
  });

  ipcMain.handle(IPC_CHANNELS.windowChrome.focusMain, () => {
    const win = getWindow();
    if (!win || win.isDestroyed()) {
      return;
    }
    restoreAndFocus(win);
  });

  ipcMain.handle(IPC_CHANNELS.windowChrome.setPlayerOpen, (_event, open: boolean) => {
    playerOverlayOpen = Boolean(open);
  });
}

/** Bind close/minimize/fullscreen so player ≠ app quit and Mac Space не «съедает» окно. */
export function bindMainWindowChrome(win: BrowserWindow): void {
  win.on('enter-full-screen', () => {
    win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, true);
  });
  win.on('leave-full-screen', () => {
    win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, false);
  });
  win.on('enter-html-full-screen', () => {
    // Блокируем HTML fullscreen — уводит окно в странное состояние на Mac.
    if (win.isDestroyed()) {
      return;
    }
    void win.webContents.executeJavaScript(
      'document.fullscreenElement && document.exitFullscreen().catch(() => {})',
    );
  });

  win.on('minimize', () => {
    // Из fullscreen-Space minimize делает окно невидимым — сначала выходим.
    if (isWindowFullscreen(win)) {
      applyFullscreen(win, false);
      win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, false);
    }
  });

  win.on('close', (event) => {
    if (isAppQuitting) {
      return;
    }

    // Пока открыт плеер — красный крестик / Cmd+W закрывают только плеер.
    if (playerOverlayOpen) {
      event.preventDefault();
      applyFullscreen(win, false);
      win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, false);
      win.webContents.send(IPC_CHANNELS.windowChrome.closePlayer);
      win.show();
      win.focus();
      return;
    }

    // macOS: hide вместо destroy — окно не «пропадает», Dock вернёт.
    if (process.platform === 'darwin') {
      event.preventDefault();
      if (isWindowFullscreen(win)) {
        applyFullscreen(win, false);
        win.webContents.send(IPC_CHANNELS.windowChrome.fullScreenChanged, false);
      }
      win.hide();
    }
  });
}

export function getMacTrafficLightPosition(collapsed = false): { x: number; y: number } {
  return collapsed ? MAC_TRAFFIC_LIGHT_POSITION.collapsed : MAC_TRAFFIC_LIGHT_POSITION.expanded;
}
