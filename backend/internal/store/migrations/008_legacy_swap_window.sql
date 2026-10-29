-- The old rost_uid swap may run more than once for a short while after the first, so parallel
-- requests, a reload before the cookie arrives or a failed answer all land on the same account.
-- legacy_uid stays the mark; legacy_swapped_at is when the first swap ran (ISO, like created_at).
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_swapped_at TEXT;
