-- admins, content, progress, tracking

ALTER TABLE users ADD COLUMN IF NOT EXISTS quiz JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_earned INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

-- we only keep sha256(token)
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

-- moments + news, doc = json for the app
CREATE TABLE IF NOT EXISTS content_items (
  kind       TEXT NOT NULL,
  id         TEXT NOT NULL,
  status     TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  doc        JSONB NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE TABLE IF NOT EXISTS library_completions (
  user_id      TEXT NOT NULL REFERENCES users(id),
  moment_id    TEXT NOT NULL,
  answers      JSONB NOT NULL DEFAULT '[]',
  correct      INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, moment_id)
);

-- no FK: anonymous events, and demo reset deletes users
CREATE TABLE IF NOT EXISTS track_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  name       TEXT NOT NULL,
  props      JSONB NOT NULL DEFAULT '{}',
  path       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS track_events_created_idx ON track_events(created_at);
