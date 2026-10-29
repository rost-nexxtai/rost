-- An account saved with an email and a password, to log back in on any device.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
