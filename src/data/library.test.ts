import { describe, expect, it } from 'vitest';
import { openTestLibrary } from './test-db';
import type { Candidate } from './types';

const candidate = (title: string, author: string, extra: Partial<Candidate> = {}): Candidate => ({
  title,
  authors: [author],
  year: null,
  cover_url: null,
  ol_key: null,
  isbn: null,
  pages: null,
  ...extra,
});

describe('Library', () => {
  it('agrega libros y no duplica por Open Library, ISBN ni título y autor', async () => {
    const lib = await openTestLibrary();
    const a = await lib.addBook(
      candidate('El nombre del viento', 'Patrick Rothfuss', { ol_key: '/works/OL1W' }),
    );
    expect(a.duplicate).toBe(false);

    expect(
      (await lib.addBook(candidate('Otro título', 'Otro', { ol_key: '/works/OL1W' }))).duplicate,
    ).toBe(true);
    await lib.addBook(candidate('Elantris', 'Brandon Sanderson', { isbn: '9780765350374' }));
    expect((await lib.addBook(candidate('x', 'y', { isbn: '9780765350374' }))).book.title).toBe(
      'Elantris',
    );
    expect(
      (await lib.addBook(candidate('el nombre  del VIENTO', 'patrick rothfuss'))).duplicate,
    ).toBe(true);

    expect(await lib.listBooks()).toHaveLength(2);
  });

  it('busca sin importar tildes ni mayúsculas, y filtra por estado', async () => {
    const lib = await openTestLibrary();
    await lib.addBook(candidate('Cien años de soledad', 'Gabriel García Márquez'));
    await lib.addBook(candidate('Mistborn', 'Brandon Sanderson'), {
      status: 'wishlist',
      tags: ['Cosmere'],
    });

    expect((await lib.listBooks({ query: 'garcia' }))[0].title).toBe('Cien años de soledad');
    expect((await lib.listBooks({ query: 'ANOS soledad' })).length).toBe(1);
    expect((await lib.listBooks({ query: 'cosmere' }))[0].title).toBe('Mistborn');
    expect((await lib.listBooks({ query: '100%' })).length).toBe(0);
    expect((await lib.listBooks({ status: 'wishlist' })).map((b) => b.title)).toEqual(['Mistborn']);
  });

  it('al actualizar cambia updated_at y marca fechas de lectura', async () => {
    const lib = await openTestLibrary();
    const { book } = await lib.addBook(candidate('Dune', 'Frank Herbert'));
    await new Promise((r) => setTimeout(r, 2));

    const reading = await lib.updateBook(book.id, { status: 'reading', rating: 4.5 });
    expect(reading.updated_at > book.updated_at).toBe(true);
    expect(reading.started_at).not.toBeNull();
    expect(reading.finished_at).toBeNull();

    const read = await lib.updateBook(book.id, { status: 'read' });
    expect(read.finished_at).not.toBeNull();
    expect((await lib.getBook(book.id))?.rating).toBe(4.5);
  });

  it('rechaza valores fuera del esquema', async () => {
    const lib = await openTestLibrary();
    const { book } = await lib.addBook(candidate('Dune', 'Frank Herbert'));
    await expect(lib.updateBook(book.id, { rating: 7 })).rejects.toThrow(/CHECK constraint/);
    // La transacción fallida no dejó nada a medias
    expect((await lib.getBook(book.id))?.rating).toBeNull();
  });

  it('borra de forma suave y se puede restaurar', async () => {
    const lib = await openTestLibrary();
    const { book } = await lib.addBook(candidate('Dune', 'Frank Herbert'));
    await lib.deleteBook(book.id);
    expect(await lib.listBooks()).toHaveLength(0);
    expect((await lib.getBook(book.id))?.deleted_at).not.toBeNull();
    // Un libro borrado no cuenta como duplicado
    expect((await lib.addBook(candidate('Dune', 'Frank Herbert'))).duplicate).toBe(false);

    await lib.restoreBook(book.id);
    expect(await lib.listBooks()).toHaveLength(2);
  });

  it('reordena entre vecinos, aun después de muchos movimientos', async () => {
    const lib = await openTestLibrary();
    const [a, b, c] = await Promise.all(
      ['A', 'B', 'C'].map(async (t) => (await lib.addBook(candidate(t, t))).book),
    );
    const titles = async () => (await lib.listBooks()).map((x) => x.title).join('');
    expect(await titles()).toBe('ABC');

    await lib.moveBook(c.id, null, a.id);
    expect(await titles()).toBe('CAB');
    await lib.moveBook(c.id, b.id, null);
    expect(await titles()).toBe('ABC');

    // 60 inserciones en el mismo hueco agotan la precisión de REAL y fuerzan renumerar
    for (let i = 0; i < 60; i++) {
      const [x, y] = await lib.listBooks();
      await lib.moveBook(i % 2 ? b.id : c.id, x.id, y.id);
    }
    const list = await lib.listBooks();
    expect(list[0].title).toBe('A');
    expect(new Set(list.map((x) => x.position)).size).toBe(3);
  });

  it('al cambiar de estado el libro va al final de su nueva lista', async () => {
    const lib = await openTestLibrary();
    const { book: a } = await lib.addBook(candidate('A', 'A'), { status: 'reading' });
    const { book: b } = await lib.addBook(candidate('B', 'B'));
    await lib.updateBook(b.id, { status: 'reading' });
    expect((await lib.listBooks({ status: 'reading' })).map((x) => x.id)).toEqual([a.id, b.id]);
  });

  it('avisa los cambios a quien escucha', async () => {
    const lib = await openTestLibrary();
    let calls = 0;
    const stop = lib.onChange(() => calls++);
    const { book } = await lib.addBook(candidate('A', 'A'));
    await lib.updateBook(book.id, { note: 'hola' });
    stop();
    await lib.deleteBook(book.id);
    expect(calls).toBe(2);
  });

  it('archivos: no duplica por contenido y revive un borrado', async () => {
    const lib = await openTestLibrary();
    const f = {
      book_id: null,
      path: 'vault/a.epub',
      filename: 'a.epub',
      size: 10,
      sha256: 'abc',
      format: 'epub',
      meta_title: null,
      meta_author: null,
    };
    const first = await lib.addFile(f);
    expect((await lib.addFile(f)).duplicate).toBe(true);
    await lib.deleteFile(first.file.id);
    expect(await lib.listFiles()).toHaveLength(0);
    const again = await lib.addFile(f);
    expect(again.file.id).toBe(first.file.id);
    expect(await lib.listFiles()).toHaveLength(1);
  });

  it('bandeja de entrada y ajustes', async () => {
    const lib = await openTestLibrary();
    const item = await lib.addInbox({ kind: 'text', input: 'Mira este libro' });
    await lib.setInboxCandidates(item.id, [candidate('Dune', 'Frank Herbert')]);
    expect((await lib.listInbox())[0].candidates[0].title).toBe('Dune');
    await lib.resolveInbox(item.id, 'dismissed');
    expect(await lib.listInbox()).toHaveLength(0);

    expect(await lib.getSetting('theme', 'auto')).toBe('auto');
    await lib.setSetting('theme', 'dark');
    expect(await lib.getSetting('theme', 'auto')).toBe('dark');
  });
});
