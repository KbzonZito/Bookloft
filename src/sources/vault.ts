// La bóveda: EPUB y PDF guardados en el almacenamiento privado de la app, vinculados a libros.
// Android Auto Backup no los respalda (pesan demasiado); van en el respaldo completo (Fase 5).
import { Capacitor } from '@capacitor/core';
import { FileViewer } from '@capacitor/file-viewer';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Book, Library, VaultFile } from '../data';
import { normalize } from '../data/text';
import { formatOf, readEpubMeta, sha256, titleFromFilename, type FileMeta } from './epub';
import { lookup } from './openlibrary';
import { fromBase64, toBase64 } from './bytes';

const native = Capacitor.isNativePlatform();
const DIR = Directory.Data;

/** Lo que llega para guardar: un File del selector o una ruta nativa (compartido desde otra app) */
export type VaultSource = File | { path: string; name: string; mimeType: string };

export class VaultError extends Error {
  constructor(readonly kind: 'format' | 'read') {
    super(kind);
  }
}

async function readSource(source: VaultSource): Promise<Uint8Array> {
  if (source instanceof File) return new Uint8Array(await source.arrayBuffer());
  const { data } = await Filesystem.readFile({ path: source.path });
  return typeof data === 'string' ? fromBase64(data) : new Uint8Array(await data.arrayBuffer());
}

/** El libro de la biblioteca que corresponde a un archivo, por título y autor */
export function matchBook(books: Book[], meta: FileMeta): Book | undefined {
  if (!meta.title) return undefined;
  const title = normalize(meta.title);
  const author = normalize(meta.author ?? '');
  const sameTitle = books.filter((b) => normalize(b.title) === title);
  return (
    sameTitle.find((b) => !author || b.authors.some((a) => normalize(a) === author)) ??
    // "Elantris (Tenth Anniversary Edition)" y otros subtítulos
    books.find(
      (b) =>
        title.startsWith(normalize(b.title)) &&
        b.title.length >= 4 &&
        (!author || b.authors.some((a) => normalize(a) === author)),
    )
  );
}

export interface ImportResult {
  file: VaultFile;
  duplicate: boolean;
  /** Libro al que quedó vinculado, si se encontró o se pidió */
  book: Book | null;
}

/**
 * Guarda un archivo en la bóveda. El mismo contenido (sha256) no se duplica.
 * Si no se indica un libro, intenta vincularlo a uno de la biblioteca por sus metadatos.
 */
export async function importToVault(
  lib: Library,
  source: VaultSource,
  options: { bookId?: string; books?: Book[] } = {},
): Promise<ImportResult> {
  const name = source.name;
  const format = formatOf(name, source instanceof File ? source.type : source.mimeType);
  if (!format) throw new VaultError('format');

  let bytes: Uint8Array;
  try {
    bytes = await readSource(source);
  } catch {
    throw new VaultError('read');
  }
  const hash = await sha256(bytes);

  const existing = await lib.fileByHash(hash);
  if (existing && !existing.deleted_at) {
    const book = existing.book_id ? ((await lib.getBook(existing.book_id)) ?? null) : null;
    return { file: existing, duplicate: true, book };
  }

  const meta = format === 'epub' ? readEpubMeta(bytes) : { title: null, author: null };
  const path = `vault/${hash.slice(0, 20)}.${format}`;
  await Filesystem.writeFile({ path, data: toBase64(bytes), directory: DIR, recursive: true });

  let book: Book | null = null;
  if (options.bookId) book = (await lib.getBook(options.bookId)) ?? null;
  else if (options.books) {
    book =
      matchBook(options.books, {
        title: meta.title ?? titleFromFilename(name),
        author: meta.author,
      }) ?? null;
  }

  const { file } = await lib.addFile({
    book_id: book?.id ?? null,
    path,
    filename: name,
    size: bytes.length,
    sha256: hash,
    format,
    meta_title: meta.title ?? titleFromFilename(name),
    meta_author: meta.author,
  });
  return { file, duplicate: false, book };
}

/** Crea la ficha del libro a partir del archivo (Open Library si lo conoce) y los vincula */
export async function createBookFromFile(lib: Library, file: VaultFile): Promise<Book> {
  const title = file.meta_title ?? titleFromFilename(file.filename);
  const found = await lookup(title, file.meta_author).catch(() => null);
  const { book } = await lib.addBook(
    found ?? {
      title,
      authors: file.meta_author ? [file.meta_author] : [],
      year: null,
      cover_url: null,
      ol_key: null,
      isbn: null,
      pages: null,
    },
    { status: 'to_read' },
  );
  await lib.linkFile(file.id, book.id);
  return book;
}

async function absolutePath(file: VaultFile) {
  const { uri } = await Filesystem.getUri({ path: file.path, directory: DIR });
  return uri;
}

async function download(file: VaultFile) {
  const { data } = await Filesystem.readFile({ path: file.path, directory: DIR });
  const blob =
    typeof data === 'string'
      ? new Blob([fromBase64(data) as Uint8Array<ArrayBuffer>], {
          type: file.format === 'pdf' ? 'application/pdf' : 'application/epub+zip',
        })
      : data;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** ¿Está el archivo en este dispositivo? Un respaldo JSON restaura la ficha, no el EPUB */
async function exists(file: VaultFile) {
  return Filesystem.stat({ path: file.path, directory: DIR }).then(
    () => true,
    () => false,
  );
}

export type OpenResult = 'ok' | 'missing' | 'no-reader';

/** Abre el archivo en el lector instalado (KOReader, Play Libros, Moon+…) */
export async function openFile(file: VaultFile): Promise<OpenResult> {
  if (!(await exists(file))) return 'missing';
  if (!native) {
    await download(file);
    return 'ok';
  }
  try {
    await FileViewer.openDocumentFromLocalPath({
      path: (await absolutePath(file)).replace(/^file:\/\//, ''),
    });
    return 'ok';
  } catch {
    return 'no-reader';
  }
}

export async function shareFile(file: VaultFile): Promise<'ok' | 'missing'> {
  if (!(await exists(file))) return 'missing';
  if (!native) await download(file);
  else {
    // En disco se llama por su huella; quien lo recibe tiene que ver el nombre original
    const named = `share/${file.filename.replace(/[\\/:*?"<>|]/g, '_')}`;
    await Filesystem.mkdir({ path: 'share', directory: Directory.Cache, recursive: true }).catch(
      () => {},
    );
    await Filesystem.deleteFile({ path: named, directory: Directory.Cache }).catch(() => {});
    await Filesystem.copy({
      from: file.path,
      directory: DIR,
      to: named,
      toDirectory: Directory.Cache,
    });
    const { uri } = await Filesystem.getUri({ path: named, directory: Directory.Cache });
    await Share.share({ title: file.meta_title ?? file.filename, files: [uri] }).catch((error) => {
      // Cerrar la hoja sin elegir también llega como error; eso no es una falla
      if (!/cancel/i.test(String(error))) throw error;
    });
  }
  return 'ok';
}

/** Borrado suave: el archivo sigue en disco un día por si se deshace; después se purga */
export async function removeFromVault(lib: Library, file: VaultFile) {
  await lib.deleteFile(file.id);
}

const PURGE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Borra del disco los archivos quitados hace más de un día (la fila queda para los respaldos) */
export async function purgeDeletedFiles(lib: Library) {
  const cutoff = new Date(Date.now() - PURGE_AFTER_MS).toISOString();
  const rows = await lib.db.all<{ path: string }>(
    `SELECT path FROM files WHERE deleted_at IS NOT NULL AND deleted_at < ?`,
    [cutoff],
  );
  for (const { path } of rows) {
    await Filesystem.deleteFile({ path, directory: DIR }).catch(() => {});
  }
}
