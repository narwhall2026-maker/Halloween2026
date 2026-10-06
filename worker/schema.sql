CREATE TABLE IF NOT EXISTS photos (
  public_id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  ip_hash TEXT,
  approved INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS photos_created_at_idx
ON photos(created_at DESC);

CREATE INDEX IF NOT EXISTS photos_ip_hash_created_at_idx
ON photos(ip_hash, created_at DESC);
