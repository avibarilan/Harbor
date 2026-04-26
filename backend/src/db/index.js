import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function initDb() {
  const dataDir = process.env.DATA_DIR || './data';
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'harbor.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sites (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      customer_name TEXT,
      tags          TEXT DEFAULT '[]',
      notes         TEXT DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS instances (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id           INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      url               TEXT NOT NULL,
      token_encrypted   TEXT NOT NULL,
      installation_type TEXT,
      status            TEXT NOT NULL DEFAULT 'disconnected',
      last_seen         TEXT,
      ha_version        TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entity_cache (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id     INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      entity_id       TEXT NOT NULL,
      state           TEXT,
      attributes_json TEXT DEFAULT '{}',
      last_updated    TEXT,
      UNIQUE(instance_id, entity_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER,
      site_id     INTEGER,
      action      TEXT NOT NULL,
      details     TEXT,
      timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS harbor_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migrations for columns added after initial release
  try { db.exec("ALTER TABLE instances ADD COLUMN cloudflare_proxied INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_enabled INTEGER DEFAULT 0"); } catch {}
  // v1.2 → v1.3: migrate from secret-based companion to Ingress-based companion
  try { db.exec("ALTER TABLE instances DROP COLUMN companion_url"); } catch {}
  try { db.exec("ALTER TABLE instances DROP COLUMN companion_secret"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_ingress_token TEXT"); } catch {}
  // Reset any previously-enabled companions so users re-enable via the new Ingress flow
  try { db.exec("UPDATE instances SET companion_enabled = 0, companion_ingress_token = NULL WHERE companion_enabled = 1"); } catch {}

  return db;
}
