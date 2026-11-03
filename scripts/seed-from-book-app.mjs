// Convierte el seed de ~/dev/book_app (notas de Obsidian ya importadas) en un respaldo JSON v1,
// para diseñar con la biblioteca real. Queda en seed/, que no se sube a git (el repo es público).
//
//   node scripts/seed-from-book-app.mjs [ruta a book_app]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import initSqlJs from 'sql.js';

const bookApp = process.argv[2] ?? join(homedir(), 'dev/book_app');
const SQL = await initSqlJs();
const db = new SQL.Database();
db.exec(readFileSync(join(bookApp, 'migrations/0001_init.sql'), 'utf8'));
db.exec(readFileSync(join(bookApp, 'seed/import.sql'), 'utf8'));

const STATUS = {
  wishlist: 'wishlist',
  por_leer: 'to_read',
  leyendo: 'reading',
  leido: 'read',
  abandonado: 'abandoned',
};

function uuidv7(time) {
  const b = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 5, t = time; i >= 0; i--, t = Math.floor(t / 256)) b[i] = t % 256;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Las notas de Obsidian traen la calificación como "★★☆"
const ratingFromNote = (note) => {
  const stars = note?.match(/[★☆]{3,5}/)?.[0];
  return stars ? [...stars].filter((s) => s === '★').length || null : null;
};

const rows = [];
const stmt = db.prepare(`
  SELECT b.*, e.status, e.priority, e.position, e.tags, e.note, e.source_url, e.added_at, e.finished_at
  FROM entries e JOIN books b ON b.id = e.book_id ORDER BY e.id`);
while (stmt.step()) rows.push(stmt.getAsObject());

const start = Date.now() - rows.length * 1000;
const books = rows.map((r, i) => {
  const added = new Date(start + i * 1000).toISOString();
  return {
    id: uuidv7(start + i * 1000),
    title: r.title,
    authors: JSON.parse(r.authors),
    series: r.series,
    series_index: r.series_index,
    isbn: r.isbn,
    ol_key: r.ol_key,
    cover_url: r.cover_url,
    cover_path: null,
    year: r.year,
    pages: r.pages,
    status: STATUS[r.status],
    priority: r.priority,
    position: r.position,
    tags: JSON.parse(r.tags),
    note: r.note,
    rating: ratingFromNote(r.note),
    source_url: r.source_url,
    added_at: added,
    started_at: r.status === 'leyendo' ? added : null,
    finished_at: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    updated_at: added,
    deleted_at: null,
  };
});

mkdirSync('seed', { recursive: true });
const out = 'seed/biblioteca-dev.json';
writeFileSync(
  out,
  JSON.stringify({
    format: 'biblioteca',
    version: 1,
    app_version: 'seed',
    exported_at: new Date().toISOString(),
    books,
    files: [],
    settings: [],
  }),
);
console.log(`${books.length} libros → ${out}`);
