import { describe, expect, it } from 'vitest';
import { exportCsv } from '../data/export-csv';
import { openTestLibrary } from '../data/test-db';
import { importFromFiles } from './import-files';
import { shouldShowOnboarding } from './onboarding';

describe('bienvenida', () => {
  it('solo en una instalación nueva', () => {
    expect(shouldShowOnboarding(0, null)).toBe(true);
    expect(shouldShowOnboarding(0, true)).toBe(false);
    expect(shouldShowOnboarding(12, null)).toBe(false);
  });
});

describe('importar archivos', () => {
  it('reconoce CSV, notas .md y listas JSON, sin duplicar', async () => {
    const lib = await openTestLibrary();
    const enriched: number[] = [];
    const enrich = (_: unknown, books: unknown[]) => void enriched.push(books.length);
    const csv = new File(
      ['Title,Author,Exclusive Shelf\nDune,Frank Herbert,read\nPiranesi,Susanna Clarke,to-read\n'],
      'goodreads_library_export.csv',
    );
    const md = new File(['- [ ] **Rayuela** — Julio Cortázar\n'], 'Lecturas.md');
    const json = new File(
      [
        JSON.stringify([
          { title: 'Dune', author: 'Frank Herbert' },
          { title: 'Ficciones', author: 'Jorge Luis Borges' },
        ]),
      ],
      'lista.json',
    );
    const r = await importFromFiles(lib, [csv, md, json], enrich);
    expect(r).toEqual({ added: 4, skipped: 1, files: 0 });
    expect(enriched).toEqual([4]);
    expect((await lib.listBooks()).map((b) => b.title).sort()).toEqual([
      'Dune',
      'Ficciones',
      'Piranesi',
      'Rayuela',
    ]);

    // Un CSV exportado por la app, importado de nuevo, no agrega nada
    const again = await importFromFiles(
      lib,
      [new File([exportCsv(await lib.listBooks())], 'b.csv')],
      enrich,
    );
    expect(again.added).toBe(0);
    expect(again.skipped).toBe(4);
  });
});
