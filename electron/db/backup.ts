import { copyFile, unlink } from 'fs/promises';
import { BrowserWindow, dialog } from 'electron';
import Database from 'better-sqlite3';
import { closeDatabase, getDatabase, getDbPath } from './database';
import { getAppSettings, type AppSettings } from './settings';

const REQUIRED_TABLES = ['settings', 'favorites', 'recently_viewed', 'watched'] as const;

export type BackupResult =
  | { ok: true; settings?: AppSettings }
  | { ok: false; cancelled?: true; error?: string };

function formatBackupFileName(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `vodomerka-backup-${yyyy}-${mm}-${dd}.db`;
}

function getParentWindow(): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && !focused.isDestroyed()) {
    return focused;
  }

  return BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) ?? null;
}

function validateBackupDatabase(filePath: string): string | null {
  let database: Database.Database | null = null;

  try {
    database = new Database(filePath, { readonly: true, fileMustExist: true });
    const rows = database
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
      .all() as Array<{ name: string }>;
    const names = new Set(rows.map((row) => row.name));

    for (const table of REQUIRED_TABLES) {
      if (!names.has(table)) {
        return `В файле нет таблицы «${table}»`;
      }
    }

    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Не удалось прочитать файл базы';
  } finally {
    database?.close();
  }
}

async function removeSidecarFiles(dbPath: string): Promise<void> {
  await Promise.allSettled([unlink(`${dbPath}-wal`), unlink(`${dbPath}-shm`)]);
}

export async function exportAppDatabase(): Promise<BackupResult> {
  const parent = getParentWindow();
  const options = {
    title: 'Экспорт базы данных',
    defaultPath: formatBackupFileName(),
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  };
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return { ok: false, cancelled: true };
  }

  const destination = result.filePath.endsWith('.db') ? result.filePath : `${result.filePath}.db`;

  try {
    const database = getDatabase();
    database.pragma('wal_checkpoint(TRUNCATE)');
    await copyFile(getDbPath(), destination);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось экспортировать базу',
    };
  }
}

export async function importAppDatabase(): Promise<BackupResult> {
  const parent = getParentWindow();
  const options = {
    title: 'Импорт базы данных',
    properties: ['openFile' as const],
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  };
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, cancelled: true };
  }

  const sourcePath = result.filePaths[0];
  const validationError = validateBackupDatabase(sourcePath);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const dbPath = getDbPath();

  try {
    closeDatabase();
    await copyFile(sourcePath, dbPath);
    await removeSidecarFiles(dbPath);
    getDatabase();
    return { ok: true, settings: getAppSettings() };
  } catch (error) {
    try {
      getDatabase();
    } catch {
      // ignore reopen failure; caller will see import error
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось импортировать базу',
    };
  }
}
