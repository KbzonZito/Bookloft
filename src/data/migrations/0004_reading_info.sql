-- Próximos, página actual y datos de Open Library para la ficha; Deseos pasa a Por leer

ALTER TABLE books ADD COLUMN up_next REAL;          -- orden en Próximos; NULL = no está
ALTER TABLE books ADD COLUMN current_page INTEGER;  -- página en que voy
ALTER TABLE books ADD COLUMN info TEXT;             -- JSON: géneros, nota promedio, editorial…

-- La lista de deseos desaparece: esos libros quedan en la Estantería como "por leer"
UPDATE books SET status = 'to_read', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE status = 'wishlist';
