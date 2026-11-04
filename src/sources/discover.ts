// Descubrir: libros para agregar, de tres fuentes sin key.
// - Para ti: otros libros de tus autores favoritos y géneros que lees (Open Library).
// - Más vendidos: ranking de Apple Books del país del teléfono (en Chile, en español).
// - Tendencias: lo más leído de la semana en Open Library.
// En el teléfono se consulta con HTTP nativo (sin CORS); en el navegador, con fetch.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { Book } from '../data';
import { normalize } from '../data/text';
import { coverUrl } from './openlibrary';
import { similarTitle } from './text';

export interface DiscoverItem {
  key: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  ol_key: string | null;
  isbn: string | null;
  year: number | null;
  /** Reseña, si la fuente la trae (Apple sí) */
  summary: string | null;
  genre: string | null;
}

export interface DiscoverRow {
  id: string;
  title: string;
  items: DiscoverItem[];
}

const native = Capacitor.isNativePlatform();

async function getJson<T>(url: string): Promise<T> {
  if (native) {
    const res = await CapacitorHttp.get({ url, connectTimeout: 10_000, readTimeout: 10_000 });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    return (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as T;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------- Caché de 12 horas en memoria ----------

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 12 * 3_600_000) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// ---------- Open Library ----------

interface OLWork {
  key: string;
  title: string;
  author_name?: string[];
  authors?: { name: string }[];
  cover_i?: number;
  cover_id?: number;
  first_publish_year?: number;
  isbn?: string[];
}

const fromOL = (w: OLWork, genre: string | null = null): DiscoverItem => {
  const cover = w.cover_i ?? w.cover_id;
  return {
    key: w.key,
    title: w.title,
    author: w.author_name?.[0] ?? w.authors?.[0]?.name ?? null,
    cover_url: cover ? coverUrl(cover) : null,
    ol_key: w.key.startsWith('/works/') ? w.key : null,
    isbn: w.isbn?.find((i) => i.length === 13) ?? null,
    year: w.first_publish_year ?? null,
    summary: null,
    genre,
  };
};

export const trending = () =>
  cached('trending', async () => {
    const { works = [] } = await getJson<{ works?: OLWork[] }>(
      'https://openlibrary.org/trending/weekly.json?limit=30',
    );
    return works.filter((w) => w.cover_i).map((w) => fromOL(w));
  });

async function byAuthor(author: string): Promise<DiscoverItem[]> {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('author', author);
  url.searchParams.set('sort', 'editions');
  url.searchParams.set('limit', '12');
  url.searchParams.set('fields', 'key,title,author_name,cover_i,first_publish_year,isbn');
  const { docs = [] } = await getJson<{ docs?: OLWork[] }>(url.toString());
  // La búsqueda por autor es aproximada ("Frank Herbert" trae a Bram Stoker): mismo apellido
  const surname = normalize(author).split(' ').at(-1) ?? '';
  return docs
    .filter(
      (d) => d.cover_i && d.author_name?.some((a) => normalize(a).split(' ').at(-1) === surname),
    )
    .map((d) => fromOL(d));
}

async function bySubject(subject: string): Promise<DiscoverItem[]> {
  const slug = normalize(subject).replace(/\s+/g, '_');
  const { works = [] } = await getJson<{ works?: OLWork[] }>(
    `https://openlibrary.org/subjects/${encodeURIComponent(slug)}.json?limit=16`,
  );
  return works.filter((w) => w.cover_id).map((w) => fromOL(w, subject));
}

// ---------- Apple Books ----------

interface AppleEntry {
  'im:name': { label: string };
  'im:artist'?: { label: string };
  'im:image'?: { label: string }[];
  summary?: { label: string };
  category?: { attributes?: { label?: string } };
  id?: { attributes?: { 'im:id'?: string } };
  'im:releaseDate'?: { label: string };
}

/** País de la tienda: la región del teléfono ("es-CL" → cl) */
export function storeCountry() {
  const region = navigator.language.split('-')[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toLowerCase() : 'us';
}

export const bestsellers = (country = storeCountry()) =>
  cached(`apple-${country}`, async () => {
    const { feed } = await getJson<{ feed?: { entry?: AppleEntry[] | AppleEntry } }>(
      `https://itunes.apple.com/${country}/rss/toppaidebooks/limit=50/json`,
    );
    const entries = Array.isArray(feed?.entry) ? feed.entry : feed?.entry ? [feed.entry] : [];
    return entries.map((e): DiscoverItem => {
      const image = e['im:image']?.at(-1)?.label ?? null;
      // La URL de la portada trae el ISBN: …/9788408328841.jpg/0x170bb.png
      const isbn = image?.match(/\/(97[89]\d{10})\./)?.[1] ?? null;
      return {
        key: `apple-${e.id?.attributes?.['im:id'] ?? e['im:name'].label}`,
        title: e['im:name'].label,
        author: e['im:artist']?.label ?? null,
        cover_url: image?.replace(/\/\d*x\d+bb\./, '/600x600bb.') ?? null,
        ol_key: null,
        isbn,
        year: Number(e['im:releaseDate']?.label.slice(0, 4)) || null,
        summary: e.summary?.label ?? null,
        genre: e.category?.attributes?.label ?? null,
      };
    });
  });

// ---------- Para ti ----------

/** Tus autores favoritos: los que más leíste, ponderados por cómo los calificaste */
export function favoriteAuthors(books: Book[], max = 4) {
  const score = new Map<string, number>();
  for (const b of books) {
    const a = b.authors[0];
    if (!a || (b.status !== 'read' && b.status !== 'reading')) continue;
    score.set(a, (score.get(a) ?? 0) + 1 + (b.rating ? (b.rating - 3) / 2 : 0));
  }
  return [...score]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([a]) => a);
}

/** Los géneros que más lees, según lo que Open Library dice de tus libros */
export function favoriteSubjects(books: Book[], max = 2) {
  const count = new Map<string, number>();
  for (const b of books) {
    if (b.status === 'abandoned') continue;
    for (const s of b.info?.subjects ?? []) count.set(s, (count.get(s) ?? 0) + 1);
  }
  return [...count]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([s]) => s);
}

/** ¿Ya lo tengo? Mismo título (parecido) y, si se sabe, mismo autor */
export function owned(
  books: Book[],
  item: Pick<DiscoverItem, 'title' | 'author' | 'ol_key' | 'isbn'>,
) {
  return books.some(
    (b) =>
      !b.deleted_at &&
      ((item.ol_key && b.ol_key === item.ol_key) ||
        (item.isbn && b.isbn === item.isbn) ||
        (similarTitle(b.title, item.title) &&
          (!item.author ||
            !b.authors[0] ||
            normalize(b.authors[0]).split(' ').at(-1) ===
              normalize(item.author).split(' ').at(-1)))),
  );
}

export async function forYou(books: Book[]): Promise<DiscoverRow[]> {
  const authors = favoriteAuthors(books);
  const subjects = favoriteSubjects(books);
  const rows = await Promise.all([
    ...authors.map(async (a): Promise<DiscoverRow> => ({
      id: `author-${a}`,
      title: a,
      items: (await cached(`author-${a}`, () => byAuthor(a)).catch(() => [])).filter(
        (i) => !owned(books, i),
      ),
    })),
    ...subjects.map(async (s): Promise<DiscoverRow> => ({
      id: `subject-${s}`,
      title: s,
      items: (await cached(`subject-${s}`, () => bySubject(s)).catch(() => [])).filter(
        (i) => !owned(books, i),
      ),
    })),
  ]);
  return rows.filter((r) => r.items.length >= 2);
}
