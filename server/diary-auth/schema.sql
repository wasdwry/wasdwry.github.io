CREATE TABLE IF NOT EXISTS login_states (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  channel TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_expiry ON login_states(expires_at);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  csrf TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  login TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
