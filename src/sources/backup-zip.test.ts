import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candidate } from '../data';
import { openTestLibrary } from '../data/test-db';

// Disco en memoria en lugar del Filesystem de Capacitor (DATA y CACHE por separado)
const disk = vi.hoisted(() => new Map<string, string>());
const key = (dir: string, path: string) => `${dir}:${path}`;
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA', Cache: 'CACHE' },
  Filesystem: {
    writeFile: vi.fn(
      async ({ path, data, directory }: Record<string, string>) =>
        void disk.set(key(directory, path), data),
    ),
    readFile: vi.fn(async ({ path, directory }: Record<string, string>) => {
      const data = disk.get(key(directory, path));
      if (data === undefined) throw new Error('missing');
      return { data };
    }),
    stat: vi.fn(async ({ path, directory }: Record<string, string>) => {
      if (!disk.has(key(directory, path))) throw new Error('missing');
      return {};
    }),
    deleteFile: vi.fn(
      async ({ path, directory }: Record<string, string>) => void disk.delete(key(directory, path)),
    ),
    getUri: vi.fn(async ({ path }: Record<string, string>) => ({ uri: `file:///${path}` })),
  },
}));
vi.mock('@capacitor/file-viewer', () => ({ FileViewer: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));
vi.mock('./books', () => ({ findBook: vi.fn(async () => null) }));
vi.mock('./covers', () => ({ ensureCover: vi.fn(async () => {}) }));

const { createBackup, restoreBackup, RestoreError } = await import('./backup-zip');
const { importToVault } = await import('./vault');

const candidate = (title: string): Candidate => ({
  title,
  authors: ['Autora'],
  year: null,
  cover_url: null,
  ol_key: null,
  isbn: null,
  pages: null,
});

function epub(title: string) {
  return zipSync({
    'META-INF/container.xml': strToU8('<container><rootfile full-path="c.opf"/></container>'),
    'c.opf': strToU8(
      `<package><dc:title>${title}</dc:title><dc:creator>Autora</dc:creator></package>`,
    ),
  });
}

async function libraryWithFile() {
  const lib = await openTestLibrary();
  const { book } = await lib.addBook(candidate('Elantris'));
  await lib.addBook(candidate('Piranesi'), { status: 'read' });
  await lib.setSetting('theme', 'dark');
  const bytes = epub('Elantris');
  const { file } = await importToVault(
    lib,
    new File([bytes as Uint8Array<ArrayBuffer>], 'elantris.epub', { type: 'application/epub+zip' }),
    { bookId: book.id },
  );
  return { lib, book, file, bytes };
}

beforeEach(() => disk.clear());

describe('respaldo ZIP', () => {
  it('el completo lleva la bóveda y se restaura entero en un teléfono nuevo', async () => {
    const { lib, book, file, bytes } = await libraryWithFile();
    const backup = await createBackup(lib, { withFiles: true });
    expect(backup.name).toMatch(/^bookloft-completo-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(backup.missing).toBe(0);

    // "Teléfono nuevo": base vacía y sin archivos
    const zip = backup.blob!;
    disk.clear();
    const fresh = await openTestLibrary();
    const r = await restoreBackup(fresh, Object.assign(zip, { name: backup.name }));

    expect(r).toMatchObject({ added: 3, filesRestored: 1, invalid: 0 });
    expect((await fresh.listBooks()).map((b) => b.title).sort()).toEqual(['Elantris', 'Piranesi']);
    expect((await fresh.listFiles(book.id))[0].id).toBe(file.id);
    expect(await fresh.getSetting('theme', 'auto')).toBe('dark');
    // El EPUB volvió al disco, idéntico
    const { fromBase64 } = await import('./bytes');
    expect(fromBase64(disk.get(`DATA:${file.path}`)!)).toEqual(bytes);
  });

  it('el de solo biblioteca no lleva archivos, pesa poco y restaura las fichas', async () => {
    const { lib } = await libraryWithFile();
    const full = await createBackup(lib, { withFiles: true });
    const light = await createBackup(lib, { withFiles: false });
    expect(light.size).toBeLessThan(full.size);

    const fresh = await openTestLibrary();
    disk.clear();
    const r = await restoreBackup(fresh, Object.assign(light.blob!, { name: light.name }));
    expect(r).toMatchObject({ added: 3, filesRestored: 0 });
  });

  it('restaurar dos veces no duplica nada ni reescribe archivos', async () => {
    const { lib } = await libraryWithFile();
    const backup = await createBackup(lib, { withFiles: true });
    const zip = Object.assign(backup.blob!, { name: backup.name });
    const r = await restoreBackup(lib, zip);
    expect(r).toMatchObject({ added: 0, updated: 0, filesRestored: 0 });
    expect(await lib.listBooks()).toHaveLength(2);
  });

  it('avisa los archivos que faltaban en el teléfono al respaldar', async () => {
    const { lib, file } = await libraryWithFile();
    disk.delete(`DATA:${file.path}`);
    expect((await createBackup(lib, { withFiles: true })).missing).toBe(1);
  });

  it('acepta el JSON de antes y rechaza lo que no es un respaldo', async () => {
    const { lib } = await libraryWithFile();
    const { exportJson } = await import('../data');
    const json = new File([JSON.stringify(await exportJson(lib))], 'viejo.json', {
      type: 'application/json',
    });
    const fresh = await openTestLibrary();
    expect((await restoreBackup(fresh, json)).added).toBe(3);

    const other = new File(
      [zipSync({ 'foto.jpg': new Uint8Array([1, 2]) }) as Uint8Array<ArrayBuffer>],
      'x.zip',
    );
    await expect(restoreBackup(fresh, other)).rejects.toBeInstanceOf(RestoreError);
    await expect(restoreBackup(fresh, new File(['basura'], 'x.zip'))).rejects.toBeInstanceOf(
      RestoreError,
    );
  });
});
