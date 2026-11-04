import { describe, expect, it } from 'vitest';
import { importBooks, parseJsonBooks, parseMarkdown } from './import-notes';
import { openTestLibrary } from './test-db';

const RUTA = `# Lecturas
## Ruta principal — Cosmere
### Scadrial — _Mistborn_, Era 1
- [x] **04 · The Final Empire** — novela · _Mistborn_ 1 · ★★★.
- [ ] **05 · The Well of Ascension** — novela · _Mistborn_ 2 · **Leyendo ahora**.
## Otras series — fuera del Cosmere
### _The Reckoners_
- [ ] **Steelheart** — no publicado aún
`;

const SAGAS = `# Joe Abercrombie
## The First Law
### The First Law Trilogy
- [x] 1. The Blade Itself
- [ ] 2. Before They Are Hanged (2007) — muy bueno
### Standalones
- [ ] 4. Best Served Cold
- [ ] Por anunciar
# Katherine Arden
## Winternight Trilogy
- [ ] **Precuela.** Small Hours
`;

const SUELTOS = `# Ficción
## Fantasy
### Prioridad alta
- [ ] **Piranesi** — Susanna Clarke ⏱️
- [x] **Tigana** — Guy Gavriel Kay (Fionavar) · relectura
### Más para explorar
- [ ] **The Spear Cuts Through Water** — Simon Jimenez
`;

describe('importar notas Markdown', () => {
  it('lee la ruta numerada con el autor del nombre del archivo', () => {
    const books = parseMarkdown(RUTA, 'Brandon Sanderson.md');
    expect(books.map((b) => b.title)).toEqual([
      'The Final Empire',
      'The Well of Ascension',
      'Steelheart',
    ]);
    expect(books[0]).toMatchObject({
      authors: ['Brandon Sanderson'],
      series: 'Mistborn',
      series_index: 1,
      status: 'read',
      tags: ['Cosmere'],
    });
    expect(books[1]).toMatchObject({ status: 'reading', series_index: 2 });
    expect(books[2]).toMatchObject({ series: 'The Reckoners', tags: ['Por publicar'] });
  });

  it('lee sagas con autor y saga de los títulos', () => {
    const books = parseMarkdown(SAGAS, 'Sagas.md');
    expect(books).toHaveLength(4);
    expect(books[1]).toMatchObject({
      title: 'Before They Are Hanged',
      authors: ['Joe Abercrombie'],
      series: 'The First Law',
      series_index: 2,
      year: 2007,
      note: 'muy bueno',
      tags: ['The First Law Trilogy'],
    });
    expect(books[0].status).toBe('read');
    expect(books[3]).toMatchObject({ title: 'Small Hours', authors: ['Katherine Arden'] });
  });

  it('lee libros independientes con autor, género y prioridad', () => {
    const books = parseMarkdown(SUELTOS, 'Standalone.md');
    expect(books).toHaveLength(3);
    expect(books[0]).toMatchObject({
      title: 'Piranesi',
      authors: ['Susanna Clarke'],
      priority: 1,
      tags: ['Fantasy', 'Lectura corta'],
    });
    expect(books[1]).toMatchObject({
      authors: ['Guy Gavriel Kay'],
      status: 'read',
      tags: ['Fantasy', 'Fionavar'],
      note: 'relectura',
    });
    expect(books[2].priority).toBe(0);
  });

  it('lee una lista simple', () => {
    const books = parseMarkdown(
      `## Pendientes\n- Piranesi — Susanna Clarke\n- [x] Dune de Frank Herbert\n1. Hyperion by Dan Simmons\n`,
      'Lista.md',
    );
    expect(books.map((b) => [b.title, b.authors[0], b.status])).toEqual([
      ['Piranesi', 'Susanna Clarke', 'to_read'],
      ['Dune', 'Frank Herbert', 'read'],
      ['Hyperion', 'Dan Simmons', 'to_read'],
    ]);
  });
});

describe('importar JSON', () => {
  it('acepta listas con nombres de campo comunes', () => {
    const books = parseJsonBooks({
      books: [
        { title: 'Dune', author: 'Frank Herbert', status: 'leido', rating: 5 },
        { titulo: 'Rayuela', autor: 'Julio Cortázar', estado: 'por_leer' },
        { title: '' },
        'basura',
      ],
    });
    expect(books).toHaveLength(2);
    expect(books[0]).toMatchObject({ authors: ['Frank Herbert'], status: 'read', rating: 5 });
    expect(books[1]).toMatchObject({ title: 'Rayuela', status: 'to_read' });
  });
});

describe('guardar sin duplicar', () => {
  it('no repite lo que ya está ni lo repetido en el archivo, y completa la saga', async () => {
    const lib = await openTestLibrary();
    const { book } = await lib.addBook({
      title: 'El Imperio Final',
      authors: ['Brandon Sanderson'],
      year: null,
      cover_url: null,
      ol_key: null,
      isbn: null,
      pages: null,
    });
    const base = {
      series: null,
      series_index: null,
      year: null,
      status: 'to_read' as const,
      priority: 0,
      tags: [],
      note: null,
    };
    const result = await importBooks(lib, [
      {
        ...base,
        title: 'El imperio final',
        authors: ['B. Sanderson'],
        series: 'Nacidos de la bruma',
        series_index: 1,
      },
      { ...base, title: 'Piranesi', authors: ['Susanna Clarke'] },
      { ...base, title: 'piranesi', authors: [] },
      { ...base, title: 'The Way of Kings', authors: ['Brandon Sanderson'], status: 'read' },
    ]);
    expect(result.added.map((b) => b.title)).toEqual(['Piranesi', 'The Way of Kings']);
    expect(result.skipped).toBe(2);
    expect(result.completed).toBe(1);
    expect((await lib.getBook(book.id))?.series).toBe('Nacidos de la bruma');
    expect(await lib.listBooks()).toHaveLength(3);

    // Importar el mismo archivo otra vez no agrega nada
    const again = await importBooks(lib, [
      { ...base, title: 'Piranesi', authors: ['Susanna Clarke'] },
    ]);
    expect(again.added).toHaveLength(0);
  });
});
