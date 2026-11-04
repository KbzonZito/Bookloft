// Importar desde CSV: las exportaciones de Goodreads y StoryGraph, o cualquier planilla con una
// columna de título (y, si hay, autor, saga, estado, nota, páginas…).
import { splitSeries } from '../sources/text';
import type { ImportedBook } from './import-notes';
import type { Status } from './types';

/** CSV según RFC 4180: comillas, comas y saltos de línea dentro de comillas, "" escapadas */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  // Planillas en español suelen usar ; como separador
  const firstLine = src.slice(0, src.indexOf('\n') >>> 0);
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const STATUS: Record<string, Status> = {
  read: 'read',
  leido: 'read',
  leído: 'read',
  'to-read': 'to_read',
  to_read: 'to_read',
  'por leer': 'to_read',
  'currently-reading': 'reading',
  reading: 'reading',
  leyendo: 'reading',
  'did-not-finish': 'abandoned',
  dnf: 'abandoned',
  abandoned: 'abandoned',
  'sin terminar': 'abandoned',
  wishlist: 'to_read',
  deseo: 'to_read',
};

const norm = (h: string) =>
  h
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** "2024/01/15" o "2024-01-15" → ISO al mediodía (para que no cambie de día por la zona) */
function date(v: string | undefined) {
  const m = v?.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T12:00:00.000Z` : null;
}
const number = (v: string | undefined) => {
  const n = Number.parseFloat((v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
/** Goodreads guarda el ISBN como ="9780..." para que Excel no lo convierta en número */
const isbn = (v: string | undefined) => (v ?? '').replace(/[^0-9Xx]/g, '') || null;

export function parseCsvBooks(text: string): ImportedBook[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(norm(h)));
  const col = {
    title: idx('title', 'titulo', 'libro', 'name', 'nombre'),
    author: idx('author', 'authors', 'autor', 'autores', 'autora'),
    extra: idx('additional authors'),
    series: idx('series', 'saga', 'serie'),
    index: idx('series index', 'series number', 'numero', 'n', 'volumen'),
    status: idx('exclusive shelf', 'read status', 'status', 'estado', 'shelf', 'estante'),
    rating: idx('my rating', 'star rating', 'rating', 'calificacion', 'nota personal', 'estrellas'),
    note: idx('my review', 'review', 'nota', 'notas', 'note', 'comentario', 'resena'),
    pages: idx('number of pages', 'pages', 'paginas'),
    year: idx('original publication year', 'year published', 'year', 'ano', 'anio'),
    isbn13: idx('isbn13', 'isbn uid'),
    isbn10: idx('isbn'),
    read: idx('date read', 'last date read', 'fecha leido', 'terminado', 'finished'),
    added: idx('date added', 'fecha agregado', 'agregado'),
    tags: idx('bookshelves', 'tags', 'etiquetas'),
  };
  if (col.title < 0) return [];
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

  const out: ImportedBook[] = [];
  for (const r of rows) {
    const raw = get(r, col.title);
    if (!raw) continue;
    // Goodreads pone la saga en el título: "The Final Empire (Mistborn, #1)"
    const split = splitSeries(raw);
    const authors = [get(r, col.author), ...get(r, col.extra).split(',')]
      .flatMap((a) => a.split(/\s*[;&]\s*|,\s+(?=\p{Lu})/u))
      .map((a) => a.trim())
      .filter(Boolean);
    const statusText = norm(get(r, col.status)).replace(/ /g, '-');
    const finished = date(get(r, col.read));
    const status =
      STATUS[statusText] ??
      STATUS[statusText.replace(/-/g, ' ')] ??
      (finished ? 'read' : 'to_read');
    const rating = number(get(r, col.rating));
    // Goodreads usa estanterías como etiquetas; las de estado no son etiquetas
    const tags = get(r, col.tags)
      .split(/\s*[,;]\s*/)
      .filter((t) => t && !STATUS[t.toLowerCase()]);
    out.push({
      title: split.title,
      authors: [...new Set(authors)],
      series: get(r, col.series) || split.series,
      series_index: number(get(r, col.index)) ?? split.index,
      year: number(get(r, col.year)),
      status,
      priority: 0,
      tags,
      note: get(r, col.note).replace(/<br\s*\/?>/gi, '\n') || null,
      isbn: isbn(get(r, col.isbn13)) ?? isbn(get(r, col.isbn10)),
      rating: rating && rating >= 0.5 && rating <= 5 ? Math.round(rating * 2) / 2 : null,
      finished_at: status === 'read' ? finished : null,
      added_at: date(get(r, col.added)),
      pages: number(get(r, col.pages)),
    });
  }
  return out;
}
