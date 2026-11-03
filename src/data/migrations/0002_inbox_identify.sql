-- Resultado de identificar lo que llegó a la bandeja, para no repetir la búsqueda al reabrir

ALTER TABLE inbox ADD COLUMN method TEXT;                      -- isbn | ai | ocr | search | none
ALTER TABLE inbox ADD COLUMN queries TEXT NOT NULL DEFAULT '[]'; -- JSON: lo que se buscó en Open Library
ALTER TABLE inbox ADD COLUMN identified_at TEXT;
ALTER TABLE inbox ADD COLUMN error TEXT;                       -- por qué falló la IA, si falló
