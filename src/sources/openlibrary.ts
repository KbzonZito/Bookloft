// Búsqueda en Open Library (adaptado de book_app/src/worker/openlibrary.ts).
// Open Library responde con CORS abierto, así que se consulta directo desde la app.
import type { Candidate } from '../data';

const FIELDS =
  'key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,series_name,series_position';

interface OLDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  series_name?: string[];
  series_position?: string[];
}

export function coverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M') {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

function toCandidate(doc: OLDoc, isbn?: string): Candidate {
  const index = Number.parseFloat(doc.series_position?.[0] ?? '');
  return {
    title: doc.title,
    authors: doc.author_name?.slice(0, 3) ?? [],
    year: doc.first_publish_year ?? null,
    cover_url: doc.cover_i ? coverUrl(doc.cover_i) : null,
    ol_key: doc.key ?? null,
    isbn: isbn ?? doc.isbn?.find((i) => i.length === 13) ?? doc.isbn?.[0] ?? null,
    pages: doc.number_of_pages_median ?? null,
    series: doc.series_name?.[0] ?? null,
    series_index: Number.isFinite(index) ? index : null,
  };
}

async function query(
  params: Record<string, string>,
  limit: number,
  signal?: AbortSignal,
): Promise<Candidate[]> {
  const url = new URL('https://openlibrary.org/search.json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('limit', String(limit));
  const timeout = AbortSignal.timeout(10_000);
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!res.ok) throw new Error(`Open Library respondió ${res.status}`);
  const data = (await res.json()) as { docs: OLDoc[] };
  return data.docs.map((d) => toCandidate(d, params.isbn));
}

/** Búsqueda libre: "piranesi clarke" */
export function search(q: string, limit = 12, signal?: AbortSignal) {
  return query({ q }, limit, signal);
}

/** El libro de un ISBN, si Open Library lo conoce */
export async function byIsbn(isbn: string, signal?: AbortSignal): Promise<Candidate | null> {
  return (await query({ isbn }, 1, signal))[0] ?? null;
}

/** Mejor coincidencia para un título y autor ya conocidos (por ejemplo, lo que leyó la IA) */
export async function lookup(title: string, author?: string | null): Promise<Candidate | null> {
  const params: Record<string, string> = { title };
  if (author) params.author = author;
  const [first] = await query(params, 1);
  if (first) return first;
  // Sin resultados con autor: reintentar solo con el título
  if (author) return (await query({ title }, 1))[0] ?? null;
  return null;
}

/** Junta resultados de varias búsquedas sin repetir el mismo libro */
export function mergeCandidates(lists: Candidate[][]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of lists.flat()) {
    const key = c.ol_key ?? `${c.title}|${c.authors[0] ?? ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
