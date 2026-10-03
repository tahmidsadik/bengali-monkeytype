CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  pass_hash   TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expires ON sessions(expires_at);

CREATE TABLE results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  mode        TEXT NOT NULL CHECK (mode IN ('time', 'words')),
  amount      INTEGER NOT NULL,
  wpm         REAL NOT NULL,
  raw         REAL NOT NULL,
  accuracy    REAL NOT NULL,
  consistency REAL NOT NULL,
  seconds     REAL NOT NULL,
  correct     INTEGER NOT NULL,
  incorrect   INTEGER NOT NULL,
  extra       INTEGER NOT NULL,
  missed      INTEGER NOT NULL,
  snapshots   TEXT NOT NULL
);
CREATE INDEX results_user_created ON results(user_id, created_at DESC);
CREATE INDEX results_user_mode ON results(user_id, mode, amount);
