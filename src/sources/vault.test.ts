import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestLibrary } from '../data/test-db';
import type { Candidate } from '../data';

// Disco en memoria en lugar del Filesystem de Capacitor
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Filesystem: {
    writeFile: vi.fn(
      async ({ path, data }: { path: string; data: string }) => void disk.set(path, data),
    ),
    readFile: vi.fn(async ({ path }: { path: string }) => ({ data: disk.get(path) })),
    deleteFile: vi.fn(async ({ path }: { path: string }) => void disk.delete(path)),
    stat: vi.fn(async ({ path }: { path: string }) => {
      if (!disk.has(path)) throw new Error('missing');
      return {};
    }),
    getUri: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///data/${path}` })),
  },
}));
vi.mock('@capacitor/file-viewer', () => ({ FileViewer: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));
vi.mock('./openlibrary', () => ({ lookup: vi.fn(async () => null) }));

const { importToVault, matchBook, createBookFromFile, openFile } = await import('./vault');
const { readEpubMeta } = await import('./epub');

function epub(title: string, author: string) {
  return zipSync({
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(
      '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
    ),
    'OEBPS/content.opf': strToU8(
      `<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator></metadata></package>`,
    ),
  });
}
const asFile = (bytes: Uint8Array, name: string) =>
  new File([bytes as Uint8Array<ArrayBuffer>], name, { type: 'application/epub+zip' });

const candidate = (title: string, author: string): Candidate => ({
  title,
  authors: [author],
  year: null,
  cover_url: null,
  ol_key: null,
  isbn: null,
  pages: null,
});

beforeEach(() => disk.clear());

describe('bóveda', () => {
  it('lee título y autor del EPUB', () => {
    expect(readEpubMeta(epub('Elantris', 'Brandon Sanderson'))).toEqual({
      title: 'Elantris',
      author: 'Brandon Sanderson',
    });
    expect(readEpubMeta(epub('Fire &amp; Blood', 'George R. R. Martin')).title).toBe(
      'Fire & Blood',
    );
    expect(readEpubMeta(new Uint8Array([1, 2, 3]))).toEqual({ title: null, author: null });
  });

  it('guarda, se vincula solo al libro de la biblioteca y no duplica', async () => {
    const lib = await openTestLibrary();
    const { book } = await lib.addBook(candidate('Elantris', 'Brandon Sanderson'));
    const books = await lib.listBooks();
    const bytes = epub('Elantris', 'Brandon Sanderson');

    const first = await importToVault(lib, asFile(bytes, 'elantris.epub'), { books });
    expect(first).toMatchObject({ duplicate: false, book: { id: book.id } });
    expect(first.file).toMatchObject({ format: 'epub', meta_title: 'Elantris', book_id: book.id });
    expect(disk.has(first.file.path)).toBe(true);

    const again = await importToVault(lib, asFile(bytes, 'otro-nombre.epub'), { books });
    expect(again.duplicate).toBe(true);
    expect(await lib.listFiles()).toHaveLength(1);
  });

  it('avisa si la ficha del archivo está pero el EPUB no (respaldo JSON sin archivos)', async () => {
    const lib = await openTestLibrary();
    const { file } = await importToVault(lib, asFile(epub('Dune', 'Frank Herbert'), 'd.epub'));
    disk.delete(file.path);
    expect(await openFile(file)).toBe('missing');
  });

  it('rechaza lo que no es EPUB ni PDF', async () => {
    const lib = await openTestLibrary();
    await expect(importToVault(lib, new File(['x'], 'nota.txt'))).rejects.toThrow(/format/);
  });

  it('un archivo sin libro puede crear su ficha', async () => {
    const lib = await openTestLibrary();
    const { file } = await importToVault(
      lib,
      asFile(epub('Piranesi', 'Susanna Clarke'), 'p.epub'),
      {
        books: [],
      },
    );
    expect(file.book_id).toBeNull();
    const book = await createBookFromFile(lib, file);
    expect(book).toMatchObject({
      title: 'Piranesi',
      authors: ['Susanna Clarke'],
      status: 'to_read',
    });
    expect((await lib.listFiles(book.id))[0].id).toBe(file.id);
  });

  it('vincula por título aunque traiga subtítulo, pero no a otro autor', async () => {
    const lib = await openTestLibrary();
    await lib.addBook(candidate('Elantris', 'Brandon Sanderson'));
    const books = await lib.listBooks();
    expect(
      matchBook(books, { title: 'Elantris (Tenth Anniversary)', author: 'Brandon Sanderson' })
        ?.title,
    ).toBe('Elantris');
    expect(matchBook(books, { title: 'Elantris', author: 'Otra Persona' })).toBeUndefined();
  });
});
