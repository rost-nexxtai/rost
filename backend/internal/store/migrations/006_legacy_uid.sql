-- The old rost_uid cookie (the raw user id) is swapped for a session once, and only for users that
-- existed before sessions: every user here now. Users made from now on never get the swap.
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_uid BOOLEAN NOT NULL DEFAULT false;
UPDATE users SET legacy_uid = true;
