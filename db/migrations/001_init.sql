-- Rost: runtime data. Reference data (offers, partners, inflation, moments, scenarios)
-- stays in versioned JSON under /data.

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  name             TEXT,
  situations       JSONB NOT NULL DEFAULT '[]',
  payday           INTEGER,
  hire_date        TEXT,
  gross_monthly    NUMERIC,
  last_raise_date  TEXT,
  monthly_expenses NUMERIC,
  firsts_done      JSONB NOT NULL DEFAULT '[]',
  spending         JSONB,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  source     TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id);

CREATE TABLE IF NOT EXISTS moment_runs (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  moment_id        TEXT NOT NULL,
  trigger_event_id TEXT,
  state            TEXT NOT NULL,
  guess            NUMERIC,
  result           JSONB,
  created_at       TEXT NOT NULL,
  started_at       TEXT,
  completed_at     TEXT
);
CREATE INDEX IF NOT EXISTS moment_runs_user_idx ON moment_runs(user_id);

CREATE TABLE IF NOT EXISTS actions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  moment_run_id TEXT NOT NULL REFERENCES moment_runs(id),
  type          TEXT NOT NULL,
  params        JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL,
  follow_up_at  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS actions_user_idx ON actions(user_id);

CREATE TABLE IF NOT EXISTS referrals (
  id         TEXT PRIMARY KEY,
  click_id   TEXT NOT NULL UNIQUE,
  user_id    TEXT,
  offer_id   TEXT NOT NULL,
  partner_id TEXT,
  status     TEXT NOT NULL,
  fee_lei    NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
