CREATE TABLE IF NOT EXISTS activations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,
  status      TEXT    NOT NULL DEFAULT 'active',  -- active | revoked | expired
  max_devices INTEGER NOT NULL DEFAULT 1,
  remark      TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT                                 -- NULL = 永不过期
);
ALTER TABLE activations ADD COLUMN remark TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS devices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  activation_id INTEGER NOT NULL REFERENCES activations(id),
  fingerprint   TEXT    NOT NULL,
  bound_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  last_seen_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(activation_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS files (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  TEXT,
  type       TEXT NOT NULL CHECK(type IN ('folder','file')),
  size       INTEGER DEFAULT 0,
  mime_type  TEXT,
  r2_key     TEXT,
  is_public  INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_id);
