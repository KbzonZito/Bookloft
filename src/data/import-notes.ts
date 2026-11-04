// Importar libros desde notas Markdown (como las de Obsidian) o desde un JSON, sin duplicar.
// Formatos que reconoce (los de las notas de lectura en Obsidian, más listas simples):
//   Ruta numerada:  - [x] **12 · Título** — nota                  (autor = nombre del archivo, saga en ### _Saga_)
//   Sagas:          # Autor / ## Saga / ### Subserie / - [ ] 1. Título (2026) — nota
//   Independientes: # Ficción / ## Género / ### Prioridad alta / - [ ] **Título** — Autor (extra) ⏱️
//   Lista simple:   - Título — Autor   ·   - [ ] Título de Autor   ·   1. Título by Author
import { uuidv7, now } from './ids';
import { EXPORT_MARK, PRIORITY_TAGS, STATUS_TAGS } from './export-notes';
import { toBook, type Library } from './library';
import { normalize } from './text';
import { STATUSES, type Book, type Status } from './types';

export interface ImportedBook {
  title: string;
  authors: string[];
  series: string | null;
  series_index: number | null;
  year: number | null;
  status: Status;
  priority: number;
  tags: string[];
  note: string | null;
  isbn?: string | null;
  rating?: number | null;
}

const stripMd = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s(])_(.+?)_(?=[\s.,;:)]|$)/g, '$1$2')
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** "Título (2026) — comentario" → título, año y nota */
function splitTitle(raw: string) {
  let [title, ...rest] = raw.split(/\s+—\s+/);
  let note = rest.join(' — ');
  let year: number | null = null;
  const y = title.match(/\s*\((\d{4})\)\s*$/);
  if (y) {
    year = Number(y[1]);
    title = title.slice(0, y.index);
  }
  const paren = title.match(/\s*\(([^)]+)\)\s*$/);
  if (paren) {
    note = [paren[1], note].filter(Boolean).join(' — ');
    title = title.slice(0, paren.index);
  }
  return { title: stripMd(title), year, note: stripMd(note) || null };
}

const statusOf = (done: string | undefined, text: string): Status =>
  /leyendo ahora|reading now/i.test(text)
    ? 'reading'
    : done?.toLowerCase() === 'x'
      ? 'read'
      : 'to_read';

/** Un nombre de archivo que parece persona ("Brandon Sanderson.md"), no una lista ("Sagas.md") */
function authorFromFile(fileName: string) {
  const name = fileName.replace(/\.(md|markdown|txt)$/i, '').trim();
  const words = name.split(/\s+/);
  return words.length >= 2 && words.length <= 4 && words.every((w) => /^\p{Lu}/u.test(w))
    ? name
    : null;
}

/**
 * En una nota exportada por esta app, los títulos (# Autor, ## Saga) no son etiquetas, y la nota de
 * cada libro trae la calificación en estrellas y el estado, la prioridad y las etiquetas como #tags.
 */
function applyMarkers(book: ImportedBook): ImportedBook {
  let note = book.note ?? '';
  const tags: string[] = [];
  note = note.replace(/(^|\s)#([\p{L}\p{N}_/-]+)/gu, (_, sp: string, tag: string) => {
    tags.push(tag);
    return sp;
  });
  const star = note.match(/(★+)(½)?/);
  if (star) note = note.replace(star[0], '');
  const statusEntry = Object.entries(STATUS_TAGS).find(([, t]) => tags.includes(t!));
  const priority = PRIORITY_TAGS.findIndex((t, i) => i > 0 && tags.includes(t));
  const known = new Set<string>([...Object.values(STATUS_TAGS), ...PRIORITY_TAGS] as string[]);
  return {
    ...book,
    status: statusEntry ? (statusEntry[0] as Status) : book.status,
    priority: priority > 0 ? priority : book.priority,
    rating: star ? star[1].length + (star[2] ? 0.5 : 0) : (book.rating ?? null),
    authors: book.authors.filter((a) => a !== 'Sin autor'),
    tags: tags.filter((t) => !known.has(t)).map((t) => t.replace(/-/g, ' ')),
    note: oneLine(note.replace(/^[\s·—-]+|[\s·—-]+$/g, '')) || null,
  };
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

export function parseMarkdown(text: string, fileName = ''): ImportedBook[] {
  const exported = /^---[\s\S]*?\n---/.test(text) && text.slice(0, 400).includes(EXPORT_MARK);
  const books = parseLines(text, fileName, exported);
  return exported ? books.map(applyMarkers) : books;
}

function parseLines(text: string, fileName: string, exported: boolean): ImportedBook[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const books: ImportedBook[] = [];
  const fileAuthor = exported ? null : authorFromFile(fileName);
  let h1 = '';
  let h2 = '';
  let h3 = '';

  for (const line of lines) {
    if (/^#\s/.test(line)) [h1, h2, h3] = [stripMd(line.slice(2)), '', ''];
    else if (/^##\s/.test(line)) [h2, h3] = [line.slice(3).trim(), ''];
    else if (/^###\s/.test(line)) h3 = line.slice(4).trim();
    if (line.startsWith('#')) continue;

    // Ruta numerada: "- [x] **12 · Título** — nota"
    let m = line.match(/^\s*[-*] \[( |x|X)\] \*\*(?:(\d+) · )?(.+?)\*\*\s*(?:—\s*(.*))?$/);
    if (m && (m[2] || (fileAuthor && !/—\s*\p{Lu}/u.test(line)))) {
      const [, done, , title, rest = ''] = m;
      const series = h3.match(/_(.+?)_/)?.[1] ?? h2.match(/_(.+?)_/)?.[1] ?? null;
      // "_Mistborn_ 2" en la nota da el número dentro de la saga
      const idx = series
        ? rest.match(
            new RegExp(`_${series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\s+(\\d+(?:\\.\\d+)?)`),
          )
        : null;
      const tags: string[] = [];
      if (/cosmere/i.test(h2) && !/fuera del cosmere/i.test(h2)) tags.push('Cosmere');
      if (/no publicad|por publicar/i.test(rest)) tags.push('Por publicar');
      books.push({
        title: stripMd(title),
        authors: fileAuthor ? [fileAuthor] : [],
        series,
        series_index: idx ? Number(idx[1]) : null,
        year: null,
        status: statusOf(done, rest),
        priority: 0,
        tags,
        note:
          stripMd(rest.replace(/\*\*Leyendo ahora\*\*\.?/i, '')).replace(/[.\s·]+$/, '') || null,
      });
      continue;
    }

    // Independientes: "- [ ] **Título** — Autor (extra) ⏱️"
    m = line.match(/^\s*[-*] (?:\[( |x|X)\] )?\*\*(.+?)\*\*\s*(?:—|-|–)\s*(.+)$/);
    if (m) {
      const [, done, rawTitle, rest] = m;
      if (exported) {
        // Formato propio: "**Título (año)** — Autor · nota ★★★ #tags" (sin reglas de las notas a mano)
        const [author, ...noteParts] = rest.split(' · ');
        const { title, year } = splitTitle(rawTitle);
        books.push({
          title,
          authors: author.trim() && author.trim() !== '?' ? [author.trim()] : [],
          series: null,
          series_index: null,
          year,
          status: statusOf(done, ''),
          priority: 0,
          tags: [],
          note: noteParts.join(' · ') || null,
        });
        continue;
      }
      const short = /⏱️/.test(rest);
      const authorPart = rest.replace(/⏱️/g, '');
      const extra = authorPart.match(/\(([^)]+)\)/)?.[1];
      const [author, ...noteParts] = authorPart.replace(/\([^)]*\)/g, '').split(/\s+·\s+|\s+—\s+/);
      const { title, year, note } = splitTitle(rawTitle);
      const genre = stripMd(h2);
      const tags = [genre || h1].filter(Boolean);
      if (h1 && genre && !/^ficci|^fiction/i.test(h1)) tags.unshift(h1);
      if (extra) tags.push(extra);
      if (short) tags.push('Lectura corta');
      books.push({
        title,
        authors: stripMd(author) ? [stripMd(author)] : [],
        series: null,
        series_index: null,
        year,
        status: statusOf(done, rest),
        priority: /prioridad alta|high priority/i.test(h3) ? 1 : 0,
        tags: [...new Set(tags.filter((t) => !/lecturas? independientes/i.test(t)))],
        note: [note, stripMd(noteParts.join(' · '))].filter(Boolean).join(' — ') || null,
      });
      continue;
    }

    // Sagas: "- [ ] 1. Título (2026) — nota" o "- [ ] **Precuela.** Título" bajo # Autor / ## Saga
    m = line.match(/^\s*[-*] \[( |x|X)\] (?:([\d.]+)\.|\*\*Precuela\.\*\*)\s+(.+)$/);
    if (m && h1) {
      const [, done, num, raw] = m;
      if (/^por anunciar|^tba\b/i.test(raw)) continue;
      const { title, year, note } = splitTitle(raw);
      const saga = stripMd(h2);
      const sub = stripMd(h3);
      const tags: string[] = [];
      if (sub && sub !== saga) tags.push(sub);
      if (/pendiente de publicaci/i.test(raw)) tags.push('Por publicar');
      books.push({
        title,
        authors: [h1],
        series: saga || null,
        series_index: num ? Number.parseFloat(num) : 0,
        year,
        status: statusOf(done, raw),
        priority: 0,
        tags,
        note,
      });
      continue;
    }

    // Lista simple: "- [ ] Título — Autor", "- Título de Autor", "1. Título by Author"
    m = line.match(/^\s*(?:[-*]|\d+[.)])\s+(?:\[( |x|X)\]\s+)?(.+)$/);
    if (m) {
      const [, done, raw] = m;
      if (/^por anunciar|^tba\b/i.test(raw)) continue;
      const clean = stripMd(raw);
      const parts =
        clean.match(/^(.+?)\s+[—–-]\s+(.+)$/) ?? clean.match(/^(.+?),?\s+(?:de|by|por)\s+(.+)$/);
      const { title, year } = splitTitle(parts ? parts[1] : clean);
      if (!title || title.length > 140) continue;
      const author = parts?.[2].replace(/\s*\(.*\)\s*$/, '').trim() || fileAuthor;
      books.push({
        title,
        authors: author ? [author] : [],
        series: null,
        series_index: null,
        year,
        status: statusOf(done, raw),
        priority: 0,
        tags: h2 || h1 ? [stripMd(h2 || h1)] : [],
        note: null,
      });
    }
  }
  return books;
}

// ---------- JSON ----------

const STATUS_ALIASES: Record<string, Status> = {
  por_leer: 'to_read',
  'to-read': 'to_read',
  leyendo: 'reading',
  'currently-reading': 'reading',
  leido: 'read',
  leído: 'read',
  abandonado: 'abandoned',
  dnf: 'abandoned',
  sin_terminar: 'abandoned',
  'did-not-finish': 'abandoned',
  lo_quiero: 'wishlist',
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

/** Una lista de libros en JSON: [{title, author|authors, series, status…}] o {books: [...]} */
export function parseJsonBooks(data: unknown): ImportedBook[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { books?: unknown }).books)
      ? (data as { books: unknown[] }).books
      : [];
  const out: ImportedBook[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = str(o.title) ?? str(o.titulo) ?? str(o.name);
    if (!title) continue;
    const authors = Array.isArray(o.authors)
      ? o.authors.filter((a): a is string => typeof a === 'string' && !!a.trim())
      : (str(o.author) ?? str(o.autor) ?? '').split(/\s*[,;&]\s*/).filter(Boolean);
    const rawStatus = (str(o.status) ?? str(o.estado) ?? str(o.shelf) ?? '').toLowerCase();
    const status = (STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as Status)
      : (STATUS_ALIASES[rawStatus] ?? 'to_read');
    const rating = num(o.rating);
    out.push({
      title,
      authors,
      series: str(o.series) ?? str(o.saga),
      series_index: num(o.series_index ?? o.seriesIndex ?? o.series_position),
      year: num(o.year ?? o.anio),
      status,
      priority: Math.min(2, Math.max(0, num(o.priority) ?? 0)),
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
      note: str(o.note) ?? str(o.nota),
      isbn: str(o.isbn) ?? str(o.isbn13),
      rating: rating && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    });
  }
  return out;
}

// ---------- Guardar sin duplicar ----------

const key = (title: string) =>
  normalize(title)
    .replace(/^(the|a|an|el|la|los|las|un|una)\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const surname = (author: string | undefined) =>
  normalize(author ?? '')
    .split(' ')
    .at(-1) ?? '';

/** Mismo título y, si los dos tienen autor, mismo apellido */
function sameBook(
  a: { title: string; authors: string[] },
  b: { title: string; authors: string[] },
) {
  if (key(a.title) !== key(b.title)) return false;
  return !a.authors.length || !b.authors.length || surname(a.authors[0]) === surname(b.authors[0]);
}

export interface NotesImportResult {
  added: Book[];
  /** Ya estaban en la biblioteca (o repetidos en el mismo archivo) */
  skipped: number;
  /** Ya estaban, y se les completó la saga que les faltaba */
  completed: number;
}

export async function importBooks(lib: Library, items: ImportedBook[]): Promise<NotesImportResult> {
  const result: NotesImportResult = { added: [], skipped: 0, completed: 0 };
  await lib.db.transaction(async (tx) => {
    // Dentro de la transacción se consulta con tx: la base atiende una cosa a la vez
    const existing = (await tx.all('SELECT * FROM books WHERE deleted_at IS NULL')).map(toBook);
    const maxByStatus = new Map<Status, number>();
    for (const b of existing) {
      maxByStatus.set(b.status, Math.max(maxByStatus.get(b.status) ?? 0, b.position ?? 0));
    }
    const fill: Book[] = [];
    const t = now();

    for (const item of items) {
      const title = item.title.trim();
      if (!title) continue;
      const known = [...existing, ...result.added].find((b) => sameBook(b, item));
      if (known) {
        result.skipped++;
        // Lo único que se completa de un libro que ya estaba: la saga, si no la tenía
        if (!known.series && item.series && !fill.includes(known)) {
          Object.assign(known, {
            series: item.series,
            series_index: item.series_index,
            updated_at: t,
          });
          if (existing.includes(known)) fill.push(known);
          result.completed++;
        }
        continue;
      }
      const position = (maxByStatus.get(item.status) ?? 0) + 1;
      maxByStatus.set(item.status, position);
      result.added.push({
        id: uuidv7(),
        title,
        authors: item.authors,
        series: item.series,
        series_index: item.series_index,
        isbn: item.isbn ?? null,
        ol_key: null,
        cover_url: null,
        cover_path: null,
        year: item.year,
        pages: null,
        description: null,
        status: item.status,
        priority: item.priority,
        position,
        tags: item.tags,
        note: item.note,
        rating: item.rating ?? null,
        source_url: null,
        added_at: t,
        started_at: item.status === 'reading' ? t : null,
        finished_at: null,
        updated_at: t,
        deleted_at: null,
      });
    }
    await lib.writeBooks(tx, [...result.added, ...fill]);
  });
  if (result.added.length || result.completed) lib.notify();
  return result;
}
