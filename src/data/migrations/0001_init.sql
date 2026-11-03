-- Esquema inicial. Una biblioteca por dispositivo: no hay usuarios.
-- IDs UUIDv7 y fechas ISO UTC generadas en la app; updated_at y deleted_at permiten fusionar respaldos.

CREATE TABLE books (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  authors      TEXT NOT NULL DEFAULT '[]',   -- JSON: ["Brandon Sanderson"]
  series       TEXT,
  series_index REAL,
  isbn         TEXT,
  ol_key       TEXT,                         -- /works/OL123W
  cover_url    TEXT,                         -- portada remota (Open Library)
  cover_path   TEXT,                         -- copia local en el dispositivo
  year         INTEGER,
  pages        INTEGER,
  status       TEXT NOT NULL DEFAULT 'to_read'
               CHECK (status IN ('wishlist', 'to_read', 'reading', 'read', 'abandoned')),
  priority     INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 2),
  position     REAL,                         -- orden dentro de su estado; REAL para insertar entre dos
  tags         TEXT NOT NULL DEFAULT '[]',   -- JSON: ["Cosmere", "Fantasía"]
  note         TEXT,
  rating       REAL CHECK (rating BETWEEN 0.5 AND 5),
  source_url   TEXT,
  added_at     TEXT NOT NULL,
  started_at   TEXT,
  finished_at  TEXT,
  search_text  TEXT NOT NULL DEFAULT '',     -- título, autores, saga y etiquetas sin tildes ni mayúsculas
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
CREATE INDEX books_status_position ON books (status, position) WHERE deleted_at IS NULL;
CREATE INDEX books_ol_key ON books (ol_key);
CREATE INDEX books_isbn ON books (isbn);

-- Bóveda de archivos (EPUB/PDF) guardados en el dispositivo
CREATE TABLE files (
  id          TEXT PRIMARY KEY,
  book_id     TEXT REFERENCES books (id) ON DELETE SET NULL,
  path        TEXT NOT NULL,
  filename    TEXT NOT NULL,
  size        INTEGER NOT NULL,
  sha256      TEXT NOT NULL UNIQUE,
  format      TEXT NOT NULL,
  meta_title  TEXT,
  meta_author TEXT,
  added_at    TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX files_book ON files (book_id);

-- Lo que llega al compartir a la app, hasta que se confirma o descarta
CREATE TABLE inbox (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('text', 'url', 'image')),
  input      TEXT,
  image_path TEXT,
  candidates TEXT NOT NULL DEFAULT '[]',     -- JSON con candidatos de Open Library
  state      TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'done', 'dismissed')),
  book_id    TEXT REFERENCES books (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX inbox_state ON inbox (state, created_at);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,                  -- JSON
  updated_at TEXT NOT NULL
);
