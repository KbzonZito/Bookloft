// Reseña y páginas de un libro, que se buscan la primera vez que se abre su ficha.
// Reseña: Apple Books primero, porque la tiene en el idioma del título ("El imperio final" en
// español); si no, la de la obra en Open Library (casi siempre en inglés).
// Páginas: Open Library (la mediana de sus ediciones); Apple Books no las da para ebooks.
import type { Book, BookInfo, Library } from '../data';
import { completeBook } from './covers';
import { googleLookup } from './googlebooks';
import { similarTitle } from './text';

const MAX = 1200;

/** HTML de Apple (o Markdown de Open Library) a texto plano con párrafos */
export function plainText(raw: string): string {
  const html = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');
  const text = new DOMParser().parseFromString(html, 'text/html').documentElement.textContent ?? '';
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [texto](link)
    .replace(/\(\[[^\]]*\]\[\d+\]\)/g, '') // ([fuente][1])
    .replace(/^\s*\[\d+\]:.*$/gm, '') // notas al pie de los links
    .replace(/^-{3,}[\s\S]*$/m, '') // "----------" y lo que sigue (ver también, contenidos)
    .replace(/^\s*An Apple Books .{0,40}edition\.?\s*$/gim, '') // aviso fijo de Apple
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*(\n\s*)+/g, '\n\n')
    .trim();
}

/** Corta en un final de oración cerca del máximo, para que la ficha no sea un muro de texto */
function clip(text: string) {
  if (text.length <= MAX) return text;
  const cut = text.slice(0, MAX);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'));
  return (end > MAX * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`).trim();
}

/** La tienda de Apple del país del teléfono ("es-CL" → CL): ahí están las ediciones locales */
function country() {
  const region = navigator.language.split('-')[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : 'US';
}

interface AppleBook {
  trackName?: string;
  artistName?: string;
  description?: string;
}

async function appleDescription(book: Book): Promise<string | null> {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', [book.title, book.authors[0]].filter(Boolean).join(' '));
  url.searchParams.set('media', 'ebook');
  url.searchParams.set('limit', '5');
  url.searchParams.set('country', country());
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const { results = [] } = (await res.json()) as { results?: AppleBook[] };
  const surname = book.authors[0]?.split(' ').at(-1)?.toLowerCase();
  const hit = results.find(
    (r) =>
      r.description &&
      r.trackName &&
      similarTitle(r.trackName, book.title) &&
      (!surname || !r.artistName || r.artistName.toLowerCase().includes(surname)),
  );
  return hit?.description ? plainText(hit.description) : null;
}

async function openLibraryDetails(book: Book) {
  if (!book.ol_key?.startsWith('/works/')) return { description: null, pages: null };
  const base = `https://openlibrary.org${book.ol_key}`;
  const [work, editions] = await Promise.all([
    fetch(`${base}.json`, { signal: AbortSignal.timeout(10_000) }).then((r) =>
      r.ok ? r.json() : null,
    ) as Promise<{ description?: string | { value?: string } } | null>,
    book.pages
      ? null
      : (fetch(`${base}/editions.json?limit=50&fields=number_of_pages`, {
          signal: AbortSignal.timeout(10_000),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null) as Promise<{ entries?: { number_of_pages?: number }[] } | null>),
  ]);
  const raw = typeof work?.description === 'string' ? work.description : work?.description?.value;
  const counts = (editions?.entries ?? [])
    .map((e) => e.number_of_pages ?? 0)
    .filter((n) => n > 20 && n < 5000)
    .sort((a, b) => a - b);
  return {
    description: raw ? plainText(raw) : null,
    pages: counts.length ? counts[Math.floor(counts.length / 2)] : null,
  };
}

interface InfoDoc {
  ratings_average?: number;
  ratings_count?: number;
  subject?: string[];
  publisher?: string[];
  language?: string[];
  edition_count?: number;
  first_publish_year?: number;
}

/** Los temas de Open Library vienen mezclados ("nyt:…", "Fiction, general", en minúscula) */
export function cleanSubjects(subjects: string[] = [], max = 5) {
  const noise =
    /[:=(]|general|^fiction$|^novela$|accessible book|protected daisy|in library|large type|ficción|translation|criticism|interpretation|reader|lecture|morceaux|roman |juvenile|textbook|study and teaching|open library|staff picks|award|nyt|new york times|^\d|readers/i;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of subjects) {
    const s = raw.trim();
    // Temas cortos, sin códigos ni etiquetas de bibliotecas
    if (!s || s.length > 24 || s.split(/\s+/).length > 3 || noise.test(s)) continue;
    const nice = s.charAt(0).toUpperCase() + s.slice(1);
    const key = nice.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(nice);
    if (out.length === max) break;
  }
  return out;
}

/** Nota promedio, géneros, editoriales, idiomas y ediciones: una sola consulta por la obra */
async function openLibraryInfo(book: Book): Promise<BookInfo | null> {
  if (!book.ol_key?.startsWith('/works/')) return null;
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('q', `key:${book.ol_key}`);
  url.searchParams.set(
    'fields',
    'ratings_average,ratings_count,subject,publisher,language,edition_count,first_publish_year',
  );
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const doc = ((await res.json()) as { docs: InfoDoc[] }).docs[0];
  if (!doc) return {};
  return {
    ratings_average: doc.ratings_average ? Math.round(doc.ratings_average * 100) / 100 : undefined,
    ratings_count: doc.ratings_count,
    subjects: cleanSubjects(doc.subject),
    publishers: doc.publisher?.slice(0, 4),
    languages: doc.language?.slice(0, 8),
    editions: doc.edition_count,
    first_publish_year: doc.first_publish_year,
  };
}

const inflight = new Set<string>();

/** Completa reseña y páginas si faltan. Sin internet no hace nada (se reintenta la próxima vez). */
export async function ensureDetails(lib: Library, book: Book) {
  if (book.description !== null && book.pages && book.info) return;
  if (!navigator.onLine || inflight.has(book.id)) return;
  inflight.add(book.id);
  try {
    // Sin ficha de Open Library no hay de dónde sacar las páginas: primero se completa el libro
    if (!book.ol_key) {
      await completeBook(lib, book).catch(() => 0);
      book = (await lib.getBook(book.id)) ?? book;
    }
    const [apple, ol, info] = await Promise.allSettled([
      book.description === null ? appleDescription(book) : Promise.resolve(null),
      openLibraryDetails(book),
      book.info ? Promise.resolve(null) : openLibraryInfo(book),
    ]);
    const appleText = apple.status === 'fulfilled' ? apple.value : null;
    const olDetails = ol.status === 'fulfilled' ? ol.value : null;
    // Google Books, para lo que no está en las otras dos (autopublicados, libros recientes)
    const needGoogle = book.description === null && !appleText && !olDetails?.description;
    const google =
      needGoogle || (!book.pages && !olDetails?.pages)
        ? await googleLookup(book.title, book.authors[0]).catch(() => null)
        : null;
    const googleText = google?.description ? plainText(google.description) : null;
    const found = appleText || olDetails?.description || googleText;
    // "No hay reseña" solo se guarda si las dos fuentes respondieron; si una falló, se reintenta
    const sure = apple.status === 'fulfilled' && ol.status === 'fulfilled';
    const patch: Partial<Book> = {};
    if (book.description === null && (found || sure)) patch.description = clip(found || '');
    const pages = olDetails?.pages ?? google?.candidate.pages;
    if (!book.pages && pages) patch.pages = pages;
    // Sin datos de Open Library, los géneros de Google sirven para la pestaña Información
    if (!book.info && !book.ol_key && google?.categories.length) {
      patch.info = { subjects: cleanSubjects(google.categories.flatMap((c) => c.split(' / '))) };
    }
    // {} = se buscó y Open Library no tiene más: no se vuelve a preguntar
    if (!book.info && info.status === 'fulfilled' && (info.value || book.ol_key)) {
      patch.info = info.value ?? {};
    }
    if (Object.keys(patch).length) await lib.updateBook(book.id, patch);
  } finally {
    inflight.delete(book.id);
  }
}
