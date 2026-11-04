// Progreso de sagas y "¿Qué leo ahora?" sin IA. Todo se calcula con los libros que hay en la
// biblioteca: "3 de 7" son los 7 que tienes de esa saga, no los que ha publicado el autor.
import { createContext, useContext } from 'react';
import type { Book } from '../data';
import { normalize } from '../data/text';

export interface SeriesProgress {
  series: string;
  author: string;
  total: number;
  read: number;
  reading: number;
  /** El primer libro sin leer (por número), si la saga ya se empezó */
  next: Book | null;
  started: boolean;
  /** Los libros de la saga en orden */
  books: Book[];
}

const seriesKey = (b: Book) => `${normalize(b.authors[0] ?? '')}|${normalize(b.series ?? '')}`;
const byIndex = (a: Book, b: Book) =>
  (a.series_index ?? 9e9) - (b.series_index ?? 9e9) || a.title.localeCompare(b.title);

export function seriesProgress(books: Book[]): Map<string, SeriesProgress> {
  const groups = new Map<string, Book[]>();
  for (const b of books) {
    if (!b.series) continue;
    const k = seriesKey(b);
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const out = new Map<string, SeriesProgress>();
  for (const [k, list] of groups) {
    list.sort(byIndex);
    const read = list.filter((b) => b.status === 'read').length;
    const reading = list.filter((b) => b.status === 'reading').length;
    // Los abandonados no cuentan como pendientes de la saga
    const pending = list.filter((b) => b.status === 'to_read' || b.status === 'wishlist');
    const started = read + reading > 0;
    // Lo que sigue es lo primero sin leer después del último leído: si leíste el libro 1, la
    // precuela (libro 0) no "sigue"; solo se propone cuando no queda nada más adelante
    const lastRead = Math.max(
      ...list.filter((b) => b.status === 'read').map((b) => b.series_index ?? -1),
      -1,
    );
    const ahead = pending.find((b) => (b.series_index ?? 9e9) > lastRead);
    out.set(k, {
      series: list[0].series!,
      author: list[0].authors[0] ?? '',
      total: list.length,
      read,
      reading,
      next: started && !reading ? (ahead ?? pending[0] ?? null) : null,
      started,
      books: list,
    });
  }
  return out;
}

export const progressFor = (map: Map<string, SeriesProgress>, b: Book) =>
  b.series ? map.get(seriesKey(b)) : undefined;

// ---------- ¿Qué leo ahora? ----------

export type ReasonKey =
  | 'next.continue'
  | 'next.continueRecent'
  | 'next.mustRead'
  | 'next.priority'
  | 'next.favoriteAuthor'
  | 'next.startSeries'
  | 'next.short'
  | 'next.waiting';

export interface Suggestion {
  book: Book;
  reasons: { key: ReasonKey; vars?: Record<string, string | number> }[];
  score: number;
}

const DAY = 86_400_000;

/**
 * Puntaje simple y explicable: seguir una saga empezada pesa más que todo, después lo que
 * marcaste como importante, autores que te gustaron y lecturas cortas. Devuelve los mejores,
 * sin repetir saga ni autor, para que las opciones sean distintas entre sí.
 */
export function suggestNext(books: Book[], now = Date.now(), limit = 3): Suggestion[] {
  return diverse(rankCandidates(books, now), limit);
}

/** Todos los candidatos con su puntaje, del mejor al peor (la IA recibe los primeros) */
export function rankCandidates(books: Book[], now = Date.now()): Suggestion[] {
  const progress = seriesProgress(books);
  const ratings = new Map<string, number[]>();
  for (const b of books) {
    if (b.status === 'read' && b.rating && b.authors[0]) {
      const a = normalize(b.authors[0]);
      ratings.set(a, [...(ratings.get(a) ?? []), b.rating]);
    }
  }
  const lastRead = new Map<string, number>();
  for (const b of books) {
    if (b.status === 'read' && b.series && b.finished_at) {
      const k = seriesKey(b);
      lastRead.set(k, Math.max(lastRead.get(k) ?? 0, Date.parse(b.finished_at)));
    }
  }

  let pool = books.filter((b) => b.status === 'to_read');
  if (!pool.length) pool = books.filter((b) => b.status === 'wishlist');

  const scored: Suggestion[] = [];
  for (const book of pool) {
    const reasons: Suggestion['reasons'] = [];
    let score = 0;
    const p = progressFor(progress, book);
    if (p) {
      if (p.started && p.next?.id === book.id) {
        const finished = lastRead.get(seriesKey(book)) ?? 0;
        const recent = now - finished < 60 * DAY;
        score += recent ? 7 : 5;
        reasons.push({
          key: recent ? 'next.continueRecent' : 'next.continue',
          vars: { series: p.series, n: p.books.indexOf(book) + 1, total: p.total },
        });
      } else if (p.started) {
        // Un libro más adelante en una saga en curso (o la saga se está leyendo): primero va el que sigue
        continue;
      } else {
        const first = books
          .filter((b) => b.series && seriesKey(b) === seriesKey(book))
          .sort(byIndex)[0];
        if (first?.id !== book.id) continue; // no empezar una saga por el libro 3
        score += 1;
        reasons.push({ key: 'next.startSeries', vars: { series: p.series } });
      }
    }
    if (book.priority === 2) {
      score += 4;
      reasons.push({ key: 'next.mustRead' });
    } else if (book.priority === 1) {
      score += 2;
      reasons.push({ key: 'next.priority' });
    }
    const author = book.authors[0];
    const rated = author ? ratings.get(normalize(author)) : undefined;
    if (author && rated?.length) {
      const avg = rated.reduce((a, b) => a + b, 0) / rated.length;
      if (avg >= 4) {
        score += 2;
        reasons.push({ key: 'next.favoriteAuthor', vars: { author } });
      }
    }
    if (book.pages && book.pages < 250) {
      score += 1;
      reasons.push({ key: 'next.short', vars: { n: book.pages } });
    }
    // Lo que lleva mucho esperando en la pila sube un poco
    const waited = (now - Date.parse(book.added_at)) / DAY;
    if (waited > 365) {
      score += 0.5;
      if (!reasons.length) reasons.push({ key: 'next.waiting' });
    }
    scored.push({ book, reasons, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.book.position ?? 9e9) - (b.book.position ?? 9e9) ||
      a.book.added_at.localeCompare(b.book.added_at),
  );

  return scored;
}

/** Los mejores, sin repetir saga ni autor, para que las opciones sean distintas entre sí */
function diverse(scored: Suggestion[], limit: number) {
  const picked: Suggestion[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    const group = s.book.series ? seriesKey(s.book) : normalize(s.book.authors[0] ?? s.book.id);
    if (seen.has(group)) continue;
    seen.add(group);
    picked.push(s);
    if (picked.length === limit) break;
  }
  return picked;
}

// ---------- Para la ficha: el progreso de su saga y cómo abrir otro libro ----------

export const ReadingContext = createContext<{
  progress: Map<string, SeriesProgress>;
  openBook: (b: Book) => void;
}>({ progress: new Map(), openBook: () => {} });

export const useReading = () => useContext(ReadingContext);
