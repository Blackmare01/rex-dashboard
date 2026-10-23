CREATE TABLE IF NOT EXISTS sessions (
  session_hash TEXT PRIMARY KEY NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY NOT NULL,
  settings_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
