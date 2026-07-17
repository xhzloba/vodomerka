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
      watched_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  return db;
}

export function closeDatabase() {
  db?.close();
  db = null;
}
