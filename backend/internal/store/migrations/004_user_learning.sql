-- What the app keeps between visits, on the server instead of a browser cookie: lessons left
-- halfway and the days with a finished lesson.
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning JSONB;
