-- Real sessions and email login. The cookie holds a random token; we only keep sha256(token).

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
-- lowercase, set by the app; NULLs don't collide
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- one-time login links; user_id is the session that asked for the link, if any
CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_tokens_email_idx ON login_tokens(email);

-- erasure and export look these up by user
CREATE INDEX IF NOT EXISTS referrals_user_idx ON referrals(user_id);
CREATE INDEX IF NOT EXISTS track_events_user_idx ON track_events(user_id);
