// Resumen del año: lo que terminaste de leer en un año, contado con las fechas de "Terminado".
// Los libros marcados como leídos sin fecha (por ejemplo, importados de notas) no caen en ningún
// año: se cuentan aparte para poder avisar y que se les ponga la fecha.
import type { Book } from '../data';

export interface YearStats {
  year: number;
  books: Book[];
  pages: number;
  /** Cuántos de los leídos tienen páginas conocidas (para no inventar el total) */
  withPages: number;
  avgRating: number | null;
  byMonth: number[];
  topAuthors: { author: string; count: number }[];
  topRated: Book[];
  longest: Book | null;
  shortest: Book | null;
  seriesCompleted: string[];
  started: number;
}

const yearOf = (iso: string | null) => (iso ? Number(iso.slice(0, 4)) : null);

export function yearsWithReading(books: Book[], now = new Date()): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const b of books) {
    const y = b.status === 'read' ? yearOf(b.finished_at) : null;
    if (y) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

export const undatedReads = (books: Book[]) =>
  books.filter((b) => b.status === 'read' && !b.finished_at).length;

export function yearStats(all: Book[], year: number): YearStats {
  const books = all
    .filter((b) => b.status === 'read' && yearOf(b.finished_at) === year)
    .sort((a, b) => a.finished_at!.localeCompare(b.finished_at!));

  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const b of books) byMonth[Number(b.finished_at!.slice(5, 7)) - 1]++;

  const withPages = books.filter((b) => b.pages);
  const rated = books.filter((b) => b.rating);

  const counts = new Map<string, number>();
  for (const b of books) {
    const a = b.authors[0];
    if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const topAuthors = [...counts]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author))
    .slice(0, 3);

  // Una saga se completó este año si todos sus libros están leídos y el último se terminó ahora
  const seriesCompleted: string[] = [];
  const bySeries = new Map<string, Book[]>();
  for (const b of all) {
    if (!b.series || b.deleted_at) continue;
    const k = `${b.authors[0] ?? ''}|${b.series}`;
    bySeries.set(k, [...(bySeries.get(k) ?? []), b]);
  }
  for (const list of bySeries.values()) {
    if (list.length < 2 || !list.every((b) => b.status === 'read' && b.finished_at)) continue;
    const last = list
      .map((b) => b.finished_at!)
      .sort()
      .at(-1)!;
    if (yearOf(last) === year) seriesCompleted.push(list[0].series!);
  }

  const byPages = [...withPages].sort((a, b) => a.pages! - b.pages!);
  return {
    year,
    books,
    pages: withPages.reduce((n, b) => n + b.pages!, 0),
    withPages: withPages.length,
    avgRating: rated.length ? rated.reduce((n, b) => n + b.rating!, 0) / rated.length : null,
    byMonth,
    topAuthors,
    topRated: [...rated]
      .sort((a, b) => b.rating! - a.rating! || a.finished_at!.localeCompare(b.finished_at!))
      .slice(0, 3),
    longest: byPages.at(-1) ?? null,
    shortest: byPages.length > 1 ? byPages[0] : null,
    seriesCompleted,
    started: all.filter((b) => yearOf(b.started_at) === year).length,
  };
}
