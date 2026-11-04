import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvBooks } from './import-csv';

const GOODREADS = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
68428,"The Final Empire (Mistborn, #1)",Brandon Sanderson,"Sanderson, Brandon",,"=""076531178X""","=""9780765311788""",5,4.47,Tor,Hardcover,541,2006,2006,2024/01/15,2023/12/01,"fantasy, favorites","fantasy (#1)",read,"Increíble.<br/>Lo recomiendo, ""de verdad"".",,,1,0
13497,Piranesi,Susanna Clarke,"Clarke, Susanna",,,"=""""",0,4.2,Bloomsbury,Paperback,272,2020,2020,,2024/02/10,to-read,to-read (#3),to-read,,,,0,0
`;

const STORYGRAPH = `Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Star Rating,Review,Content Warnings,Tags,Owned?
Golden Son,Pierce Brown,,9780345539830,digital,currently-reading,2024/03/01,,,0,,,,,,,No
The Way of Kings,Brandon Sanderson,,9780765326355,paperback,did-not-finish,2024/03/02,,,0,,,3.5,,,"epic, long",Yes
`;

describe('importar CSV', () => {
  it('lee comillas, comas y saltos de línea dentro de un campo, y separador ;', () => {
    expect(parseCsv('a,b\n"x, y","línea 1\nlínea 2"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'línea 1\nlínea 2'],
    ]);
    expect(parseCsv('titulo;autor\nRayuela;Julio Cortázar')[1]).toEqual([
      'Rayuela',
      'Julio Cortázar',
    ]);
  });

  it('Goodreads: saga del título, ISBN, nota, fechas y estantes', () => {
    const [mistborn, piranesi] = parseCsvBooks(GOODREADS);
    expect(mistborn).toMatchObject({
      title: 'The Final Empire',
      series: 'Mistborn',
      series_index: 1,
      authors: ['Brandon Sanderson'],
      isbn: '9780765311788',
      rating: 5,
      status: 'read',
      pages: 541,
      year: 2006,
      finished_at: '2024-01-15T12:00:00.000Z',
      added_at: '2023-12-01T12:00:00.000Z',
      tags: ['fantasy', 'favorites'],
      note: 'Increíble.\nLo recomiendo, "de verdad".',
    });
    expect(piranesi).toMatchObject({ status: 'to_read', rating: null, isbn: null, tags: [] });
  });

  it('StoryGraph: estados, media estrella y etiquetas', () => {
    const [golden, kings] = parseCsvBooks(STORYGRAPH);
    expect(golden).toMatchObject({
      status: 'reading',
      isbn: '9780345539830',
      authors: ['Pierce Brown'],
    });
    expect(kings).toMatchObject({ status: 'abandoned', rating: 3.5, tags: ['epic', 'long'] });
  });

  it('una planilla cualquiera en español', () => {
    const books = parseCsvBooks(
      'Título;Autor;Saga;Número;Estado\nEl imperio final;Brandon Sanderson;Nacidos de la bruma;1;leído\nRayuela;Julio Cortázar;;;\n',
    );
    expect(books[0]).toMatchObject({
      series: 'Nacidos de la bruma',
      series_index: 1,
      status: 'read',
    });
    expect(books[1]).toMatchObject({ title: 'Rayuela', status: 'to_read', series: null });
    expect(parseCsvBooks('foo,bar\n1,2')).toEqual([]);
  });
});

describe('exportar CSV', () => {
  it('ida y vuelta con el importador', async () => {
    const { exportCsv } = await import('./export-csv');
    const base = {
      id: 'x',
      series: 'Nacidos de la bruma',
      series_index: 1,
      isbn: '9788466658898',
      ol_key: null,
      cover_url: null,
      cover_path: null,
      year: 2006,
      pages: 672,
      description: null,
      up_next: null,
      current_page: null,
      info: null,
      priority: 0,
      position: 1,
      source_url: null,
      added_at: '2024-01-02T12:00:00.000Z',
      started_at: null,
      updated_at: '2024-01-02T12:00:00.000Z',
      deleted_at: null,
    };
    const csv = exportCsv([
      {
        ...base,
        title: 'El imperio final',
        authors: ['Brandon Sanderson'],
        status: 'read',
        rating: 5,
        tags: ['Cosmere', 'fantasía'],
        note: 'Línea 1\nCon "comillas", y coma',
        finished_at: '2024-03-15T12:00:00.000Z',
      },
      {
        ...base,
        id: 'y',
        title: 'Piranesi',
        authors: ['Susanna Clarke'],
        series: null,
        series_index: null,
        status: 'abandoned',
        rating: null,
        tags: [],
        note: null,
        finished_at: null,
      },
    ]);
    const [a, b] = parseCsvBooks(csv);
    expect(a).toMatchObject({
      title: 'El imperio final',
      authors: ['Brandon Sanderson'],
      series: 'Nacidos de la bruma',
      series_index: 1,
      status: 'read',
      rating: 5,
      pages: 672,
      year: 2006,
      isbn: '9788466658898',
      tags: ['Cosmere', 'fantasía'],
      note: 'Línea 1\nCon "comillas", y coma',
      finished_at: '2024-03-15T12:00:00.000Z',
      added_at: '2024-01-02T12:00:00.000Z',
    });
    expect(b).toMatchObject({ title: 'Piranesi', status: 'abandoned', series: null });
  });
});
