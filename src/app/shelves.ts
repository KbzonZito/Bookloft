// Ordenar, filtrar y agrupar libros (agrupación adaptada de book_app/src/web/shelves.ts)
import type { Book, Status } from '../data';
import { normalize } from '../data/text';

export const SHELVES: Status[] = ['reading', 'to_read', 'wishlist', 'read', 'abandoned'];

export const SORTS = ['mine', 'recent', 'title', 'author'] as const;
export type Sort = (typeof SORTS)[number];

const surname = (name: string) => name.trim().split(/\s+/).pop() ?? name;
const firstAuthor = (b: Book) => b.authors[0] ?? '';
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function sortBooks(books: Book[], sort: Sort): Book[] {
  const list = [...books];
  switch (sort) {
    case 'mine':
      return list.sort(
        (a, b) => (a.position ?? 9e9) - (b.position ?? 9e9) || a.added_at.localeCompare(b.added_at),
      );
    case 'recent':
      return list.sort((a, b) =>
        (b.finished_at ?? b.added_at).localeCompare(a.finished_at ?? a.added_at),
      );
    case 'title':
      return list.sort((a, b) => collator.compare(a.title, b.title));
    case 'author':
      return list.sort(
        (a, b) =>
          collator.compare(surname(firstAuthor(a)), surname(firstAuthor(b))) ||
          collator.compare(a.series ?? '', b.series ?? '') ||
          (a.series_index ?? 0) - (b.series_index ?? 0),
      );
  }
}

/** Busca en título, autores, saga y etiquetas; cada palabra tiene que aparecer */
export function searchBooks(books: Book[], query: string): Book[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return books;
  return books.filter((b) => {
    const text = normalize([b.title, ...b.authors, b.series ?? '', ...b.tags].join(' '));
    return words.every((w) => text.includes(w));
  });
}

export interface SeriesGroup {
  name: string | null; // null = libros sueltos del autor
  books: Book[];
}
export interface AuthorGroup {
  author: string;
  count: number;
  series: SeriesGroup[];
}

export function groupByAuthorAndSeries(books: Book[], unknownAuthor: string): AuthorGroup[] {
  const authors = new Map<string, Map<string | null, Book[]>>();
  for (const b of books) {
    const author = b.authors[0] ?? unknownAuthor;
    const bySeries = authors.get(author) ?? new Map<string | null, Book[]>();
    bySeries.set(b.series, [...(bySeries.get(b.series) ?? []), b]);
    authors.set(author, bySeries);
  }
  return [...authors.entries()]
    .sort(([a], [b]) => collator.compare(surname(a), surname(b)) || collator.compare(a, b))
    .map(([author, bySeries]) => {
      const series = [...bySeries.entries()]
        .map(([name, list]) => ({
          name,
          books: list.sort(
            (a, b) =>
              (a.series_index ?? 9e9) - (b.series_index ?? 9e9) ||
              collator.compare(a.title, b.title),
          ),
        }))
        // Sagas primero, sueltos al final
        .sort((a, b) =>
          a.name === null ? 1 : b.name === null ? -1 : collator.compare(a.name, b.name),
        );
      return { author, count: series.reduce((n, s) => n + s.books.length, 0), series };
    });
}
