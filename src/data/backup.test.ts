import { describe, expect, it } from 'vitest';
import { exportJson, importJson, parseBackup } from './backup';
import { openTestLibrary } from './test-db';
import type { Candidate } from './types';

const candidate = (title: string): Candidate => ({
  title,
  authors: ['Autora'],
  year: null,
  cover_url: null,
  ol_key: null,
  isbn: null,
  pages: null,
});
const tick = () => new Promise((r) => setTimeout(r, 2));

describe('respaldo JSON', () => {
  it('exportar e importar en una base vacía deja lo mismo', async () => {
    const a = await openTestLibrary();
    const { book } = await a.addBook(candidate('Uno'), { tags: ['x'], note: 'nota' });
    await a.addBook(candidate('Dos'), { status: 'read' });
    await a.deleteBook((await a.addBook(candidate('Tres'))).book.id);
    await a.addFile({
      book_id: book.id,
      path: 'v/1.epub',
      filename: '1.epub',
      size: 1,
      sha256: 'h1',
      format: 'epub',
      meta_title: null,
      meta_author: null,
    });
    await a.setSetting('theme', 'dark');
    const backup = await exportJson(a);

    const b = await openTestLibrary();
    expect(await importJson(b, JSON.parse(JSON.stringify(backup)))).toEqual({
      added: 4,
      updated: 0,
      skipped: 0,
      invalid: 0,
    });
    const again = await exportJson(b);
    expect(again.books).toEqual(backup.books);
    expect(again.files).toEqual(backup.files);
    expect(await b.getSetting('theme', 'auto')).toBe('dark');
    expect((await b.listBooks()).map((x) => x.title)).toEqual(['Uno', 'Dos']);
  });

  it('fusiona: gana el más nuevo, el borrado se propaga y no duplica', async () => {
    const phone = await openTestLibrary();
    const { book: shared } = await phone.addBook(candidate('Compartido'));
    const { book: toDelete } = await phone.addBook(candidate('Se borra'));
    const tablet = await openTestLibrary();
    await importJson(tablet, await exportJson(phone));

    await tick();
    await tablet.updateBook(shared.id, { note: 'desde la tablet' });
    await tablet.deleteBook(toDelete.id);
    await tick();
    await phone.addBook(candidate('Solo en el teléfono'));
    const fromTablet = await exportJson(tablet);

    const r = await importJson(phone, fromTablet);
    expect(r).toMatchObject({ added: 0, updated: 2 });
    expect((await phone.getBook(shared.id))?.note).toBe('desde la tablet');
    expect((await phone.listBooks()).map((b) => b.title).sort()).toEqual([
      'Compartido',
      'Solo en el teléfono',
    ]);

    // Importar algo más viejo no pisa lo nuevo
    await tick();
    await phone.updateBook(shared.id, { note: 'más nueva' });
    expect((await importJson(phone, fromTablet)).updated).toBe(0);
    expect((await phone.getBook(shared.id))?.note).toBe('más nueva');
  });

  it('ignora filas inválidas y rechaza archivos que no son respaldos', async () => {
    const lib = await openTestLibrary();
    const backup = await exportJson(lib);
    backup.books.push({ id: 'x', title: '' } as never);
    expect((await importJson(lib, backup)).invalid).toBe(1);
    expect(() => parseBackup({ hello: 1 })).toThrow(/No es un respaldo/);
    expect(() => parseBackup({ format: 'biblioteca', version: 2 })).toThrow(/Versión/);
  });
});
