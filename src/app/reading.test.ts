import { describe, expect, it } from 'vitest';
import type { Book, Status } from '../data';
import { progressFor, seriesProgress, suggestNext } from './reading';

const NOW = Date.parse('2026-11-04T12:00:00Z');
let n = 0;
function book(title: string, over: Partial<Book> = {}): Book {
  n++;
  return {
    id: `b${n}`,
    title,
    authors: ['Autora Uno'],
    series: null,
    series_index: null,
    isbn: null,
    ol_key: null,
    cover_url: null,
    cover_path: null,
    year: null,
    pages: 400,
    description: null,
    up_next: null,
    current_page: null,
    info: null,
    status: 'to_read' as Status,
    priority: 0,
    position: n,
    tags: [],
    note: null,
    rating: null,
    source_url: null,
    added_at: '2026-10-01T00:00:00Z',
    started_at: null,
    finished_at: null,
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
    ...over,
  };
}

const saga = (title: string, i: number, status: Status, over: Partial<Book> = {}) =>
  book(title, {
    series: 'Nacidos de la bruma',
    series_index: i,
    status,
    authors: ['Brandon Sanderson'],
    ...over,
  });

describe('progreso de sagas', () => {
  it('cuenta leídos y encuentra el siguiente', () => {
    const books = [
      saga('El imperio final', 1, 'read'),
      saga('El pozo de la ascensión', 2, 'to_read'),
      saga('El héroe de las eras', 3, 'to_read'),
    ];
    const p = progressFor(seriesProgress(books), books[2])!;
    expect(p).toMatchObject({ total: 3, read: 1, started: true });
    expect(p.next?.title).toBe('El pozo de la ascensión');
  });

  it('la precuela no "sigue" si ya leíste el libro 1', () => {
    const books = [
      saga('Precuela', 0, 'to_read'),
      saga('Uno', 1, 'read'),
      saga('Dos', 2, 'to_read'),
    ];
    expect(progressFor(seriesProgress(books), books[0])!.next?.title).toBe('Dos');
    const done = [saga('Precuela', 0, 'to_read'), saga('Uno', 1, 'read')];
    expect(progressFor(seriesProgress(done), done[0])!.next?.title).toBe('Precuela');
  });

  it('sin empezar o leyendo uno, no hay "siguiente"', () => {
    const fresh = [saga('A', 1, 'to_read'), saga('B', 2, 'to_read')];
    expect(progressFor(seriesProgress(fresh), fresh[0])!.next).toBeNull();
    const reading = [saga('A', 1, 'read'), saga('B', 2, 'reading'), saga('C', 3, 'to_read')];
    expect(progressFor(seriesProgress(reading), reading[0])!.next).toBeNull();
  });
});

describe('qué leo ahora', () => {
  it('primero sigue la saga empezada, nunca un libro que se salta otro', () => {
    const books = [
      saga('El imperio final', 1, 'read', { finished_at: '2026-10-20T00:00:00Z' }),
      saga('El pozo de la ascensión', 2, 'to_read'),
      saga('El héroe de las eras', 3, 'to_read'),
      book('Piranesi', { authors: ['Susanna Clarke'] }),
    ];
    const s = suggestNext(books, NOW);
    expect(s[0].book.title).toBe('El pozo de la ascensión');
    expect(s[0].reasons[0]).toMatchObject({ key: 'next.continueRecent', vars: { n: 2, total: 3 } });
    expect(s.map((x) => x.book.title)).not.toContain('El héroe de las eras');
  });

  it('una saga nueva solo se propone desde su primer libro', () => {
    const books = [
      book('Golden Son', { series: 'Red Rising', series_index: 2, authors: ['Pierce Brown'] }),
      book('Red Rising', { series: 'Red Rising', series_index: 1, authors: ['Pierce Brown'] }),
    ];
    expect(suggestNext(books, NOW).map((s) => s.book.title)).toEqual(['Red Rising']);
  });

  it('suma prioridad, autores con buena nota y lecturas cortas, sin repetir autor', () => {
    const books = [
      book('Normal', { authors: ['X Uno'] }),
      book('Imprescindible', { authors: ['X Dos'], priority: 2 }),
      book('Corto', { authors: ['X Tres'], pages: 180 }),
      book('Otro de Le Guin', { authors: ['Ursula K. Le Guin'] }),
      book('Otro más de Le Guin', { authors: ['Ursula K. Le Guin'] }),
      book('Terramar', { authors: ['Ursula K. Le Guin'], status: 'read', rating: 5 }),
    ];
    const titles = suggestNext(books, NOW).map((s) => s.book.title);
    expect(titles).toEqual(['Imprescindible', 'Otro de Le Guin', 'Corto']);
  });

  it('sin nada por leer, no propone nada', () => {
    expect(suggestNext([book('Leído', { status: 'read' })], NOW)).toEqual([]);
  });
});
