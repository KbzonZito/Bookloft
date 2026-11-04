import { describe, expect, it } from 'vitest';
import type { Book } from '../data';
import { undatedReads, yearStats, yearsWithReading } from './year';

let n = 0;
const book = (title: string, over: Partial<Book>): Book => ({
  id: `y${++n}`,
  title,
  authors: ['Autora'],
  series: null,
  series_index: null,
  isbn: null,
  ol_key: null,
  cover_url: null,
  cover_path: null,
  year: null,
  pages: null,
  description: null,
  up_next: null,
  current_page: null,
  info: null,
  status: 'read',
  priority: 0,
  position: n,
  tags: [],
  note: null,
  rating: null,
  source_url: null,
  added_at: '2025-01-01T00:00:00Z',
  started_at: null,
  finished_at: null,
  updated_at: '2025-01-01T00:00:00Z',
  deleted_at: null,
  ...over,
});

const books = [
  book('Uno', {
    finished_at: '2026-01-10T00:00:00Z',
    pages: 300,
    rating: 5,
    authors: ['Le Guin'],
    series: 'Terramar',
    series_index: 1,
  }),
  book('Dos', {
    finished_at: '2026-03-02T00:00:00Z',
    pages: 200,
    rating: 3,
    authors: ['Le Guin'],
    series: 'Terramar',
    series_index: 2,
  }),
  book('Tres', { finished_at: '2026-03-20T00:00:00Z', pages: 500, authors: ['Herbert'] }),
  book('Viejo', { finished_at: '2025-06-01T00:00:00Z', pages: 100 }),
  book('Sin fecha', {}),
  book('Leyendo', { status: 'reading', started_at: '2026-10-01T00:00:00Z' }),
];

describe('resumen del año', () => {
  it('cuenta lo terminado en el año, sus páginas, meses, autores y sagas completas', () => {
    const s = yearStats(books, 2026);
    expect(s.books.map((b) => b.title)).toEqual(['Uno', 'Dos', 'Tres']);
    expect(s.pages).toBe(1000);
    expect(s.byMonth.slice(0, 3)).toEqual([1, 0, 2]);
    expect(s.topAuthors[0]).toEqual({ author: 'Le Guin', count: 2 });
    expect(s.avgRating).toBe(4);
    expect(s.topRated.map((b) => b.title)).toEqual(['Uno', 'Dos']);
    expect(s.longest?.title).toBe('Tres');
    expect(s.shortest?.title).toBe('Dos');
    expect(s.seriesCompleted).toEqual(['Terramar']);
    expect(s.started).toBe(1);
  });

  it('años disponibles y leídos sin fecha', () => {
    expect(yearsWithReading(books, new Date('2026-11-04'))).toEqual([2026, 2025]);
    expect(undatedReads(books)).toBe(1);
  });
});
