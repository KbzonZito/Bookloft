// Google Books: la tercera fuente, la más completa para libros autopublicados con ISBN.
// En el teléfono usa la key propia de Bookloft, restringida en Google Cloud a esta app (nombre del
// paquete + huella SHA-1 de la firma): por eso viaja por HTTP nativo con esos encabezados, y aunque
// alguien copie la key del APK o del repo, desde otro lado no sirve. En el navegador (desarrollo) va
// sin key, con la cuota compartida de Google (que se agota seguido): ahí puede fallar sin problema.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { Candidate } from '../data';
import { similarTitle, splitSeries } from './text';

const KEY = __GOOGLE_BOOKS_KEY__;
const PACKAGE = 'dev.martinvergara.biblioteca';
/** Huella SHA-1 del certificado de firma (pública; Google la pide para restringir la key) */
const CERT_SHA1 = '93260BA9708B43DCF83578C568AE3AEA1058055B';
const native = Capacitor.isNativePlatform();

export interface GoogleVolume {
  id: string;
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    description?: string;
    categories?: string[];
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    seriesInfo?: { bookDisplayNumber?: string };
  };
}

async function request(params: Record<string, string>): Promise<GoogleVolume[]> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('printType', 'books');
  if (native && KEY) {
    url.searchParams.set('key', KEY);
    const res = await CapacitorHttp.get({
      url: url.toString(),
      headers: { 'X-Android-Package': PACKAGE, 'X-Android-Cert': CERT_SHA1 },
      connectTimeout: 10_000,
      readTimeout: 10_000,
    });
    if (res.status >= 400) throw new Error(`Google Books ${res.status}`);
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return (data as { items?: GoogleVolume[] }).items ?? [];
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  return ((await res.json()) as { items?: GoogleVolume[] }).items ?? [];
}

/** La portada más grande que da Google, por https y sin la esquina doblada */
export function googleCover(v: GoogleVolume): string | null {
  const link = v.volumeInfo.imageLinks?.thumbnail ?? v.volumeInfo.imageLinks?.smallThumbnail;
  if (!link) return null;
  return link
    .replace(/^http:/, 'https:')
    .replace('&edge=curl', '')
    .replace(/zoom=\d/, 'zoom=1');
}

export function toCandidate(v: GoogleVolume): Candidate {
  const i = v.volumeInfo;
  const ids = i.industryIdentifiers ?? [];
  const isbn =
    ids.find((x) => x.type === 'ISBN_13')?.identifier ??
    ids.find((x) => x.type === 'ISBN_10')?.identifier ??
    null;
  // A veces la saga viene en el título o en el subtítulo: "The Sun Prince (Bonds of Kin Book 2)"
  const split = splitSeries(i.title ?? '');
  const fromSub = i.subtitle ? splitSeries(`x (${i.subtitle})`) : null;
  const index = Number.parseFloat(i.seriesInfo?.bookDisplayNumber ?? '');
  return {
    title: split.title,
    authors: i.authors?.slice(0, 3) ?? [],
    year: Number.parseInt(i.publishedDate?.slice(0, 4) ?? '', 10) || null,
    cover_url: googleCover(v),
    ol_key: null,
    isbn,
    pages: i.pageCount || null,
    series: split.series ?? fromSub?.series ?? null,
    series_index: split.index ?? fromSub?.index ?? (Number.isFinite(index) ? index : null),
  };
}

export async function googleSearch(q: string, limit = 10): Promise<Candidate[]> {
  const items = await request({ q, maxResults: String(Math.min(limit, 40)) });
  return items.filter((v) => v.volumeInfo.title).map(toCandidate);
}

export async function googleByIsbn(isbn: string): Promise<Candidate | null> {
  const [first] = await request({ q: `isbn:${isbn}`, maxResults: '1' });
  return first ? toCandidate(first) : null;
}

/** El mismo libro (título parecido y, si se sabe, mismo apellido) con su reseña y datos */
export async function googleLookup(
  title: string,
  author?: string | null,
): Promise<{ candidate: Candidate; description: string | null; categories: string[] } | null> {
  const q = author ? `intitle:${title} inauthor:${author.split(' ').at(-1)}` : `intitle:${title}`;
  const items = await request({ q, maxResults: '5' });
  const surname = author?.split(' ').at(-1)?.toLowerCase();
  const hit = items.find(
    (v) =>
      v.volumeInfo.title &&
      similarTitle(v.volumeInfo.title, title) &&
      (!surname || v.volumeInfo.authors?.some((a) => a.toLowerCase().includes(surname))),
  );
  if (!hit) return null;
  return {
    candidate: toCandidate(hit),
    description: hit.volumeInfo.description ?? null,
    categories: hit.volumeInfo.categories ?? [],
  };
}

