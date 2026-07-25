CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  is_private INTEGER NOT NULL DEFAULT 0,
  secret_code TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  cover_image TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE photos (
  url TEXT PRIMARY KEY,
  album_id TEXT NOT NULL REFERENCES albums(id),
  caption TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL
);

CREATE INDEX idx_photos_album_id ON photos(album_id);
