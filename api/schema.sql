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
