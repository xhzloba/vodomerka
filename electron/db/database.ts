import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database | null = null;

export function getDbPath() {
  return path.join(app.getPath('userData'), 'tv-leonid.db');
}

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  db = new Database(getDbPath());
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      media_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS recently_viewed (
      media_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      viewed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    CREATE TABLE IF NOT EXISTS watched (
      media_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      watched_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      status TEXT NOT NULL DEFAULT 'watched'
    );

    CREATE TABLE IF NOT EXISTS continue_watching (
      id TEXT PRIMARY KEY NOT NULL,
      media_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      torrent_id TEXT,
      file_path TEXT,
      position_seconds REAL NOT NULL,
      duration_seconds REAL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_continue_watching_updated_at
      ON continue_watching (updated_at DESC);
  `);

  // Legacy DBs created before status column.
  const watchedColumns = db.prepare('PRAGMA table_info(watched)').all() as Array<{ name: string }>;
  if (!watchedColumns.some((column) => column.name === 'status')) {
    db.exec(`ALTER TABLE watched ADD COLUMN status TEXT NOT NULL DEFAULT 'watched'`);
  }

  return db;
}

export function closeDatabase() {
  db?.close();
  db = null;
}
