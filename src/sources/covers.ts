// Portadas: Open Library (todas las ediciones de la obra), Apple Books como segunda fuente,
// un link pegado o una imagen propia guardada en el teléfono.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { Book, Library } from '../data';
import { coverUrl, lookup } from './openlibrary';
import { similarTitle } from './text';

export interface CoverOption {
  url: string;
  source: 'openlibrary' | 'apple';
}

const native = Capacitor.isNativePlatform();

interface AppleResult {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
}

/**
 * Apple Books: sin clave, con CORS abierto y portadas grandes. La miniatura de 100 px se pide
 * en 600 px cambiando el tamaño en la URL.
 */
export async function appleCovers(title: string, author?: string | null, limit = 8) {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', [title, author].filter(Boolean).join(' '));
  url.searchParams.set('media', 'ebook');
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const { results = [] } = (await res.json()) as { results?: AppleResult[] };
  return results
    .filter((r) => r.artworkUrl100 && r.trackName && similarTitle(r.trackName, title))
    .map((r) => ({
      url: r.artworkUrl100!.replace(/\/\d+x\d+bb\./, '/600x600bb.'),
      source: 'apple' as const,
    }));
}

/** Las portadas de todas las ediciones de una obra de Open Library, sin repetir */
async function editionCovers(olKey: string | null, limit = 60): Promise<CoverOption[]> {
  if (!olKey?.startsWith('/works/')) return [];
  const url = `https://openlibrary.org${olKey}/editions.json?limit=${limit}&fields=covers`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const { entries = [] } = (await res.json()) as { entries?: { covers?: number[] }[] };
  const ids = new Set(entries.flatMap((e) => e.covers ?? []).filter((id) => id > 0));
  return [...ids].map((id) => ({ url: coverUrl(id), source: 'openlibrary' as const }));
}

/** Todas las opciones para elegir: primero Open Library, después Apple Books */
export async function coverOptions(book: Book): Promise<CoverOption[]> {
  const [ol, apple] = await Promise.all([
    editionCovers(book.ol_key).catch(() => []),
    appleCovers(book.title, book.authors[0]).catch(() => []),
  ]);
  return [...ol, ...apple];
}

/** Si el libro no tiene portada, busca una en Apple Books y la guarda */
export async function ensureCover(lib: Library, book: Book) {
  if (book.cover_url || book.cover_path) return;
  const [first] = await appleCovers(book.title, book.authors[0], 5).catch(() => []);
  if (first) await lib.updateBook(book.id, { cover_url: first.url });
}

/**
 * Rellena lo que le falta a un libro (autor, portada, año, saga…) con Open Library y, para la
 * portada, Apple Books. Nunca pisa lo que ya tiene. Devuelve cuántos datos agregó.
 */
export async function completeBook(lib: Library, book: Book): Promise<number> {
  const found = await lookup(book.title, book.authors[0]).catch(() => null);
  const patch: Partial<Book> = {};
  if (found) {
    if (!book.authors.length && found.authors.length) patch.authors = found.authors;
    if (!book.cover_url && !book.cover_path && found.cover_url) patch.cover_url = found.cover_url;
    if (!book.ol_key && found.ol_key) patch.ol_key = found.ol_key;
    if (!book.isbn && found.isbn) patch.isbn = found.isbn;
    if (book.year == null && found.year != null) patch.year = found.year;
    if (book.pages == null && found.pages != null) patch.pages = found.pages;
    if (!book.series && found.series) {
      patch.series = found.series;
      patch.series_index = found.series_index ?? null;
    }
  }
  if (!book.cover_url && !book.cover_path && !patch.cover_url) {
    const author = patch.authors?.[0] ?? book.authors[0];
    const [first] = await appleCovers(book.title, author, 5).catch(() => []);
    if (first) patch.cover_url = first.url;
  }
  const n = Object.keys(patch).length;
  if (n) await lib.updateBook(book.id, patch);
  return n;
}

// ---------- Portadas propias (una imagen del teléfono) ----------
// En Android se guardan en covers/<id>.jpg y se muestran con la URL local de Capacitor.
// En el navegador (desarrollo) se guardan como data URL: no hay archivos que servir.

let dataDir: string | null = null;

/** Hay que llamarla al abrir la app para poder resolver las rutas locales */
export async function initLocalCovers() {
  if (!native) return;
  dataDir = (await Filesystem.getUri({ path: '', directory: Directory.Data })).uri.replace(
    /\/$/,
    '',
  );
}

export function localCoverSrc(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('data:')) return path;
  return dataDir ? Capacitor.convertFileSrc(`${dataDir}/${path}`) : null;
}

async function downscale(blob: Blob, maxSide = 900): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Guarda una imagen elegida por el usuario como portada del libro */
export async function setCustomCover(lib: Library, book: Book, image: Blob) {
  const dataUrl = await downscale(image);
  let path = dataUrl;
  if (native) {
    // Nombre nuevo cada vez: así el WebView no muestra la imagen anterior desde su caché
    path = `covers/${book.id}-${Date.now()}.jpg`;
    await Filesystem.writeFile({
      path,
      data: dataUrl.split(',')[1],
      directory: Directory.Data,
      recursive: true,
    });
    if (book.cover_path && !book.cover_path.startsWith('data:')) {
      await Filesystem.deleteFile({ path: book.cover_path, directory: Directory.Data }).catch(
        () => {},
      );
    }
  }
  await lib.updateBook(book.id, { cover_path: path });
}

/** Usa una portada de internet (link o una de las opciones) y olvida la propia */
export async function setCoverUrl(lib: Library, book: Book, url: string) {
  if (book.cover_path && !book.cover_path.startsWith('data:') && native) {
    await Filesystem.deleteFile({ path: book.cover_path, directory: Directory.Data }).catch(
      () => {},
    );
  }
  await lib.updateBook(book.id, { cover_url: url, cover_path: null });
}
