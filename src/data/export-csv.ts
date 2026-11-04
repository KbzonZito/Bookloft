// Respaldo en CSV con las columnas de Goodreads: el formato que aceptan StoryGraph, Goodreads y
// muchas otras apps, además de cualquier planilla. Esta app también lo vuelve a importar.
import type { Book, Status } from './types';

const COLUMNS = [
  'Title',
  'Author',
  'Additional Authors',
  'ISBN13',
  'My Rating',
  'Number of Pages',
  'Original Publication Year',
  'Date Read',
  'Date Added',
  'Bookshelves',
  'Exclusive Shelf',
  'My Review',
  'Series',
  'Series Index',
] as const;

const SHELF: Record<Status, string> = {
  to_read: 'to-read',
  reading: 'currently-reading',
  read: 'read',
  abandoned: 'did-not-finish',
};

/** Comillas solo cuando hacen falta; "" para las comillas internas */
const cell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Goodreads usa 2024/01/15 */
const day = (iso: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '/') : '');

export function exportCsv(books: Book[]): string {
  const rows = books
    .filter((b) => !b.deleted_at)
    .map((b) => [
      b.title,
      b.authors[0] ?? '',
      b.authors.slice(1).join(', '),
      b.isbn ?? '',
      // Goodreads solo tiene estrellas enteras; la media estrella se redondea hacia arriba
      b.rating ? Math.ceil(b.rating) : 0,
      b.pages ?? '',
      b.year ?? '',
      day(b.finished_at),
      day(b.added_at),
      b.tags.join(', '),
      SHELF[b.status],
      b.note ?? '',
      b.series ?? '',
      b.series_index ?? '',
    ]);
  // BOM: Excel abre bien las tildes
  return `﻿${[COLUMNS, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}
