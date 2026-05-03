import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function getSystemSiteId() {
  const row = db.prepare("SELECT value FROM harbor_settings WHERE key = 'system_site_id'").get();
  if (row) return parseInt(row.value, 10);
  const result = db.prepare("INSERT INTO sites (name) VALUES ('_harbor_system')").run();
  db.prepare("INSERT INTO harbor_settings (key, value) VALUES ('system_site_id', ?)").run(String(result.lastInsertRowid));
  return result.lastInsertRowid;
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

    CREATE TABLE IF NOT EXISTS locations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      notes      TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS instances (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id           INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      location_id       INTEGER REFERENCES locations(id) ON DELETE SET NULL,
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

    CREATE TABLE IF NOT EXISTS companion_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL,
      token       TEXT NOT NULL UNIQUE,
      expires_at  DATETIME NOT NULL,
      used        INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS companion_commands (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id  INTEGER NOT NULL,
      command      TEXT NOT NULL,
      payload      TEXT DEFAULT NULL,
      status       TEXT DEFAULT 'pending',
      result       TEXT DEFAULT NULL,
      error        TEXT DEFAULT NULL,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );
  `);

  // Column migrations — each wrapped in try/catch (SQLite has no IF NOT EXISTS for ADD/DROP COLUMN)
  try { db.exec("ALTER TABLE instances ADD COLUMN cloudflare_proxied INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_enabled INTEGER DEFAULT 0"); } catch {}
  // v1.2→v1.3: ingress-based companion schema
  try { db.exec("ALTER TABLE instances DROP COLUMN companion_url"); } catch {}
  try { db.exec("ALTER TABLE instances DROP COLUMN companion_secret"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_ingress_token TEXT"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_registration_secret TEXT"); } catch {}
  // v1.4: locations + direct companion (port-based) restored
  try { db.exec("ALTER TABLE instances ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_secret TEXT"); } catch {}
  // v1.2.0: poll-based companion — companion_url and registration_secret no longer used
  try { db.exec("ALTER TABLE instances DROP COLUMN companion_url"); } catch {}
  try { db.exec("ALTER TABLE instances DROP COLUMN companion_registration_secret"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_last_seen DATETIME DEFAULT NULL"); } catch {}
  try { db.exec("ALTER TABLE instances ADD COLUMN companion_version TEXT DEFAULT NULL"); } catch {}

  const companionCount = db.prepare("SELECT COUNT(*) as count FROM instances WHERE companion_enabled = 1").get();
  console.log(`[Harbor DB] Companion-enabled instances on startup: ${companionCount.count}`);

  return db;
}
