// Buscar libros en todas las fuentes: Open Library primero (abierta, con ediciones y portadas por
// idioma) y Google Books para lo que Open Library no tiene o tiene a medias (autopublicados, libros
// recientes). Toda la app busca por aquí.
import type { Candidate } from '../data';
import { normalize } from '../data/text';
import { googleByIsbn, googleLookup, googleSearch } from './googlebooks';
import { byIsbn, lookup, search } from './openlibrary';
import { similarTitle } from './text';

const surname = (a: string | undefined) =>
  normalize(a ?? '')
    .split(' ')
    .at(-1) ?? '';

/** ¿Es el mismo libro? Título parecido y, si los dos tienen autor, mismo apellido */
function same(a: Candidate, b: Candidate) {
  if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
  return (
    similarTitle(a.title, b.title) &&
    (!a.authors[0] || !b.authors[0] || surname(a.authors[0]) === surname(b.authors[0]))
  );
}

/** Une resultados: los de Open Library primero; de Google, solo lo que no estaba */
export function mergeSources(primary: Candidate[], extra: Candidate[]): Candidate[] {
  const out = [...primary];
  for (const c of extra) if (!out.some((o) => same(o, c))) out.push(c);
  return out;
}

/** Búsqueda libre ("piranesi clarke"): si una fuente falla, quedan los de la otra */
export async function searchBooks(
  q: string,
  limit = 12,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const [ol, google] = await Promise.allSettled([search(q, limit, signal), googleSearch(q, 8)]);
  if (signal?.aborted) return [];
  const a = ol.status === 'fulfilled' ? ol.value : [];
  const b = google.status === 'fulfilled' ? google.value : [];
  if (ol.status === 'rejected' && google.status === 'rejected') throw ol.reason;
  return mergeSources(a, b).slice(0, limit + 4);
}

export async function findByIsbn(isbn: string, signal?: AbortSignal): Promise<Candidate | null> {
  const ol = await byIsbn(isbn, signal).catch(() => null);
  if (ol?.authors.length && ol.cover_url) return ol;
  const google = await googleByIsbn(isbn).catch(() => null);
  if (!ol) return google;
  return google ? fillGaps(ol, google) : ol;
}

/** Completa lo que le falta a un resultado con otro del mismo libro */
function fillGaps(base: Candidate, other: Candidate): Candidate {
  return {
    ...base,
    authors: base.authors.length ? base.authors : other.authors,
    cover_url: base.cover_url ?? other.cover_url,
    isbn: base.isbn ?? other.isbn,
    year: base.year ?? other.year,
    pages: base.pages ?? other.pages,
    series: base.series ?? other.series,
    series_index: base.series_index ?? other.series_index,
  };
}

/** El libro que corresponde a un título y autor ya conocidos (IA, notas importadas, EPUB) */
export async function findBook(title: string, author?: string | null): Promise<Candidate | null> {
  const ol = await lookup(title, author).catch(() => null);
  if (ol?.authors.length && ol.cover_url) return ol;
  const google = await googleLookup(title, author).catch(() => null);
  if (!ol) return google?.candidate ?? null;
  return google ? fillGaps(ol, google.candidate) : ol;
}
