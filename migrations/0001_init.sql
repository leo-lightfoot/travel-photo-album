CREATE TABLE subscribers (
  email TEXT PRIMARY KEY,
  first_verified_at TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  verify_count INTEGER NOT NULL DEFAULT 1
);
