// Búsqueda en Open Library (adaptado de book_app/src/worker/openlibrary.ts).
// Open Library responde con CORS abierto, así que se consulta directo desde la app.
import type { Candidate } from '../data';
import { similarTitle, splitSeries } from './text';

// editions.*: Open Library devuelve la edición que mejor coincide con la búsqueda (su idioma y su portada)
const FIELDS =
  'key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,series_name,series_position,' +
  'editions,editions.key,editions.title,editions.cover_i,editions.isbn,editions.language';

interface OLEdition {
  key: string;
  title?: string;
  cover_i?: number;
  isbn?: string[];
}

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
  editions?: { docs?: OLEdition[] };
}

export function coverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M') {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * La obra reúne todas sus ediciones; su portada general puede ser de otro idioma ("Red Rising" con la
 * tapa de "Amanecer rojo"). Si la edición que coincidió tiene el título que se buscó (o el ISBN),
 * se usan su título y su portada: así se ve el libro en el idioma en que se buscó.
 */
function matchedEdition(doc: OLDoc, wanted?: string, isbn?: string): OLEdition | undefined {
  const edition = doc.editions?.docs?.[0];
  if (!edition) return undefined;
  if (isbn && edition.isbn?.includes(isbn)) return edition;
  if (wanted && edition.title && similarTitle(edition.title, wanted)) return edition;
  return undefined;
}

function toCandidate(doc: OLDoc, wanted?: string, isbn?: string): Candidate {
  const index = Number.parseFloat(doc.series_position?.[0] ?? '');
  const edition = matchedEdition(doc, wanted, isbn);
  const cover = edition?.cover_i ?? doc.cover_i;
  const editionIsbn = edition?.isbn?.find((i) => i.length === 13) ?? edition?.isbn?.[0];
  // A veces la saga viene en el título: "The Final Empire (Mistborn, #1)"
  const split = splitSeries(edition?.title ?? doc.title);
  return {
    title: split.title,
    authors: doc.author_name?.slice(0, 3) ?? [],
    year: doc.first_publish_year ?? null,
    cover_url: cover ? coverUrl(cover) : null,
    ol_key: doc.key ?? null,
    isbn: isbn ?? editionIsbn ?? doc.isbn?.find((i) => i.length === 13) ?? doc.isbn?.[0] ?? null,
    pages: doc.number_of_pages_median ?? null,
    series: doc.series_name?.[0] ?? split.series,
    series_index: Number.isFinite(index) ? index : split.index,
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
  return data.docs.map((d) => toCandidate(d, params.q ?? params.title, params.isbn));
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
  // De lo más preciso a lo más amplio; en cada intento se mira más de un resultado, porque el primero
  // a veces es un resumen, una guía o una antología con el título parecido
  const attempts: Record<string, string>[] = [];
  if (author) attempts.push({ title, author });
  attempts.push({ title });
  if (author) attempts.push({ q: `${title} ${author}` });
  attempts.push({ q: title });
  // Open Library tiene fichas vacías duplicadas (sin autor ni portada): entre los títulos que calzan
  // gana la más completa, y si la de un intento está incompleta se sigue buscando
  let best: Candidate | null = null;
  for (const params of attempts) {
    const results = await retry(() => query(params, 5));
    for (const c of results.filter((r) => similarTitle(r.title, title))) {
      if (!best || completeness(c, author) > completeness(best, author)) best = c;
    }
    if (best && completeness(best, author) >= 3) return best;
  }
  return best;
}

function completeness(c: Candidate, author?: string | null) {
  const sameAuthor = !!author && c.authors.some((a) => similarTitle(a, author));
  return (c.authors.length ? 1 : 0) + (c.cover_url ? 1 : 0) + (sameAuthor || !author ? 1 : 0);
}

/** Open Library a veces corta con 429 o 5xx cuando llegan varias consultas juntas: un reintento basta */
async function retry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 700 * i));
    }
  }
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
