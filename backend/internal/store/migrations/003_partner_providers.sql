-- banks and brokers an admin marked as partners, by key ("bank:<name>", "broker:<id>").
-- The app shows a "Partener" label; the order of the lists never looks at it.

CREATE TABLE IF NOT EXISTS partner_providers (
  key        TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
