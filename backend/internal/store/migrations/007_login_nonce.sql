-- A login link works only in the browser that asked for it: the hash of a random nonce kept in that
-- browser's rost_login cookie. Links made before this have none and stop working (15 minutes at most).
ALTER TABLE login_tokens ADD COLUMN IF NOT EXISTS nonce_hash TEXT NOT NULL DEFAULT '';
