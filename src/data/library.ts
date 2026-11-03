// Repositorio de la biblioteca: la UI solo habla con esto, nunca con SQL
import type { Db, Row, Value } from './driver';
import { now, uuidv7 } from './ids';
import { normalize, searchText } from './text';
import type {
  Book,
  BookPatch,
  Candidate,
  IdentifyMethod,
  InboxItem,
  InboxKind,
  InboxState,
  Status,
  VaultFile,
} from './types';

export const BOOK_COLUMNS = [
  'id',
  'title',
  'authors',
  'series',
  'series_index',
  'isbn',
  'ol_key',
  'cover_url',
  'cover_path',
  'year',
  'pages',
  'status',
  'priority',
  'position',
  'tags',
  'note',
  'rating',
  'source_url',
  'added_at',
  'started_at',
  'finished_at',
  'search_text',
  'updated_at',
  'deleted_at',
] as const;

export const FILE_COLUMNS = [
  'id',
  'book_id',
  'path',
  'filename',
  'size',
  'sha256',
  'format',
  'meta_title',
  'meta_author',
  'added_at',
  'updated_at',
  'deleted_at',
] as const;

const json = (v: Value, fallback: unknown) => (typeof v === 'string' ? JSON.parse(v) : fallback);

export function toBook(r: Row): Book {
  const { search_text: _, ...rest } = r;
  return {
    ...(rest as unknown as Book),
    authors: json(r.authors, []),
    tags: json(r.tags, []),
  };
}

export function bookRow(b: Book): Value[] {
  return BOOK_COLUMNS.map((c) => {
    if (c === 'search_text') return searchText(b);
    if (c === 'authors' || c === 'tags') return JSON.stringify(b[c]);
    return b[c] ?? null;
  });
}

const toFile = (r: Row) => r as unknown as VaultFile;

function toInbox(r: Row): InboxItem {
  return {
    ...(r as unknown as InboxItem),
    candidates: json(r.candidates, []),
    queries: json(r.queries, []),
  };
}

const placeholders = (n: number) => Array(n).fill('?').join(', ');
const LIVE = 'deleted_at IS NULL';

// LIKE literal: % y _ en lo que escribe el usuario no son comodines
const ESCAPE = "ESCAPE '\\'";
const contains = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

// Columnas que maneja el repositorio: un patch nunca las pisa, aunque la UI le pase el libro completo
const INTERNAL = new Set(['id', 'added_at', 'updated_at', 'deleted_at', 'position', 'search_text']);

/** Deja solo los campos editables y descarta los undefined (no borran lo guardado) */
function editable(patch: BookPatch): BookPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(
      ([k, v]) =>
        v !== undefined && !INTERNAL.has(k) && (BOOK_COLUMNS as readonly string[]).includes(k),
    ),
  );
}

export interface ListOptions {
  status?: Status;
  /** Busca en título, autores, saga y etiquetas, sin importar tildes ni mayúsculas */
  query?: string;
}

export interface AddOptions {
  status?: Status;
  source_url?: string | null;
  tags?: string[];
  note?: string | null;
}

export class Library {
  private listeners = new Set<() => void>();

  constructor(readonly db: Db) {}

  /** Avisa cada vez que algo cambia; devuelve la función para dejar de escuchar */
  onChange(listener: () => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  private changed() {
    for (const l of this.listeners) l();
  }

  // ---------- Libros ----------

  async listBooks({ status, query }: ListOptions = {}): Promise<Book[]> {
    const where = [LIVE];
    const params: Value[] = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    for (const word of normalize(query ?? '')
      .split(' ')
      .filter(Boolean)) {
      where.push(`search_text LIKE ? ${ESCAPE}`);
      params.push(contains(word));
    }
    const rows = await this.db.all(
      `SELECT * FROM books WHERE ${where.join(' AND ')} ORDER BY position, added_at`,
      params,
    );
    return rows.map(toBook);
  }

  async getBook(id: string): Promise<Book | undefined> {
    const row = await this.db.get('SELECT * FROM books WHERE id = ?', [id]);
    return row && toBook(row);
  }

  /** El mismo libro ya guardado: por Open Library, por ISBN o por título y primer autor */
  async findDuplicate(c: Candidate, db: Db = this.db): Promise<Book | undefined> {
    if (c.ol_key || c.isbn) {
      const row = await db.get(
        `SELECT * FROM books WHERE ${LIVE} AND (ol_key = ? OR isbn = ?) LIMIT 1`,
        [c.ol_key ?? '\0', c.isbn ?? '\0'],
      );
      if (row) return toBook(row);
    }
    const title = normalize(c.title);
    const author = normalize(c.authors[0] ?? '');
    const rows = await db.all(
      `SELECT * FROM books WHERE ${LIVE} AND search_text LIKE ? ${ESCAPE}`,
      [contains(title)],
    );
    return rows
      .map(toBook)
      .find((b) => normalize(b.title) === title && normalize(b.authors[0] ?? '') === author);
  }

  /** Agrega un libro al final de su estado. Si ya existe, devuelve el que estaba. */
  async addBook(c: Candidate, opts: AddOptions = {}): Promise<{ book: Book; duplicate: boolean }> {
    const result = await this.db.transaction(async (tx) => {
      const existing = await this.findDuplicate(c, tx);
      if (existing) return { book: existing, duplicate: true };

      const status = opts.status ?? 'to_read';
      const t = now();
      const book: Book = {
        id: uuidv7(),
        title: c.title.trim(),
        authors: c.authors,
        series: c.series ?? null,
        series_index: c.series_index ?? null,
        isbn: c.isbn,
        ol_key: c.ol_key,
        cover_url: c.cover_url,
        cover_path: null,
        year: c.year,
        pages: c.pages,
        status,
        priority: 0,
        position: await this.endPosition(tx, status),
        tags: opts.tags ?? [],
        note: opts.note ?? null,
        rating: null,
        source_url: opts.source_url ?? null,
        added_at: t,
        started_at: status === 'reading' ? t : null,
        finished_at: status === 'read' ? t : null,
        updated_at: t,
        deleted_at: null,
      };
      await tx.run(
        `INSERT INTO books (${BOOK_COLUMNS.join(', ')}) VALUES (${placeholders(BOOK_COLUMNS.length)})`,
        bookRow(book),
      );
      return { book, duplicate: false };
    });
    if (!result.duplicate) this.changed();
    return result;
  }

  async updateBook(id: string, patch: BookPatch): Promise<Book> {
    const book = await this.db.transaction(async (tx) => {
      const row = await tx.get('SELECT * FROM books WHERE id = ?', [id]);
      if (!row) throw new Error(`No existe el libro ${id}`);
      const before = toBook(row);
      const t = now();
      const next: Book = { ...before, ...editable(patch), updated_at: t };

      if (patch.status && patch.status !== before.status) {
        next.position = await this.endPosition(tx, patch.status);
        if (patch.status === 'reading' && !next.started_at) next.started_at = t;
        if (patch.status === 'read' && !next.finished_at) next.finished_at = t;
      }
      await this.writeBook(tx, next);
      return next;
    });
    this.changed();
    return book;
  }

  /** Borrado suave: se puede deshacer y viaja en los respaldos */
  async deleteBook(id: string) {
    const t = now();
    await this.db.run('UPDATE books SET deleted_at = ?, updated_at = ? WHERE id = ?', [t, t, id]);
    this.changed();
  }

  async restoreBook(id: string) {
    await this.db.run('UPDATE books SET deleted_at = NULL, updated_at = ? WHERE id = ?', [
      now(),
      id,
    ]);
    this.changed();
  }

  /** Mueve un libro entre dos vecinos de su lista (null = al inicio o al final) */
  async moveBook(id: string, prevId: string | null, nextId: string | null) {
    await this.db.transaction(async (tx) => {
      const pos = async (bookId: string | null) =>
        bookId
          ? ((
              await tx.get<{ position: number | null }>('SELECT position FROM books WHERE id = ?', [
                bookId,
              ])
            )?.position ?? null)
          : null;
      let [prev, next] = [await pos(prevId), await pos(nextId)];

      // Sin espacio entre los vecinos: renumerar la lista y volver a calcular
      if (prev != null && next != null && next - prev < 1e-9) {
        const { status } = (await tx.get<{ status: Status }>(
          'SELECT status FROM books WHERE id = ?',
          [id],
        ))!;
        await this.renumber(tx, status);
        [prev, next] = [await pos(prevId), await pos(nextId)];
      }

      const position =
        prev != null && next != null
          ? (prev + next) / 2
          : prev != null
            ? prev + 1
            : next != null
              ? next - 1
              : 0;
      await tx.run('UPDATE books SET position = ?, updated_at = ? WHERE id = ?', [
        position,
        now(),
        id,
      ]);
    });
    this.changed();
  }

  private async endPosition(db: Db, status: Status) {
    const row = await db.get<{ max: number | null }>(
      `SELECT MAX(position) AS max FROM books WHERE ${LIVE} AND status = ?`,
      [status],
    );
    return (row?.max ?? 0) + 1;
  }

  private async renumber(db: Db, status: Status) {
    const ids = await db.all<{ id: string }>(
      `SELECT id FROM books WHERE ${LIVE} AND status = ? ORDER BY position, added_at`,
      [status],
    );
    for (const [i, { id }] of ids.entries()) {
      await db.run('UPDATE books SET position = ? WHERE id = ?', [i + 1, id]);
    }
  }

  /** Guarda todas las columnas de un libro (insertando o reemplazando, sin borrar la fila) */
  async writeBook(db: Db, book: Book) {
    await this.writeBooks(db, [book]);
  }

  /**
   * Varios libros en una sola sentencia (hasta 40 filas × 24 columnas, bajo el límite de 999
   * parámetros de SQLite): en el teléfono cada sentencia cruza el puente nativo.
   */
  async writeBooks(db: Db, books: Book[]) {
    const updates = BOOK_COLUMNS.filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
    const row = `(${placeholders(BOOK_COLUMNS.length)})`;
    for (let i = 0; i < books.length; i += 40) {
      const chunk = books.slice(i, i + 40);
      await db.run(
        `INSERT INTO books (${BOOK_COLUMNS.join(', ')}) VALUES ${chunk.map(() => row).join(', ')}
         ON CONFLICT (id) DO UPDATE SET ${updates}`,
        chunk.flatMap(bookRow),
      );
    }
  }

  // ---------- Bóveda ----------

  async listFiles(bookId?: string): Promise<VaultFile[]> {
    const rows = bookId
      ? await this.db.all(`SELECT * FROM files WHERE ${LIVE} AND book_id = ? ORDER BY added_at`, [
          bookId,
        ])
      : await this.db.all(`SELECT * FROM files WHERE ${LIVE} ORDER BY added_at DESC`);
    return rows.map(toFile);
  }

  async fileByHash(sha256: string): Promise<VaultFile | undefined> {
    const row = await this.db.get('SELECT * FROM files WHERE sha256 = ?', [sha256]);
    return row && toFile(row);
  }

  /** Registra un archivo ya copiado al dispositivo. El mismo contenido (sha256) no se duplica. */
  async addFile(
    f: Omit<VaultFile, 'id' | 'added_at' | 'updated_at' | 'deleted_at'>,
  ): Promise<{ file: VaultFile; duplicate: boolean }> {
    const existing = await this.fileByHash(f.sha256);
    const t = now();
    if (existing && !existing.deleted_at) return { file: existing, duplicate: true };
    const file: VaultFile = existing
      ? { ...existing, ...f, deleted_at: null, updated_at: t }
      : { ...f, id: uuidv7(), added_at: t, updated_at: t, deleted_at: null };
    await this.writeFile(this.db, file);
    this.changed();
    return { file, duplicate: false };
  }

  async linkFile(fileId: string, bookId: string | null) {
    await this.db.run('UPDATE files SET book_id = ?, updated_at = ? WHERE id = ?', [
      bookId,
      now(),
      fileId,
    ]);
    this.changed();
  }

  async deleteFile(fileId: string) {
    const t = now();
    await this.db.run('UPDATE files SET deleted_at = ?, updated_at = ? WHERE id = ?', [
      t,
      t,
      fileId,
    ]);
    this.changed();
  }

  async restoreFile(fileId: string) {
    await this.db.run('UPDATE files SET deleted_at = NULL, updated_at = ? WHERE id = ?', [
      now(),
      fileId,
    ]);
    this.changed();
  }

  async writeFile(db: Db, file: VaultFile) {
    const updates = FILE_COLUMNS.filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
    await db.run(
      `INSERT INTO files (${FILE_COLUMNS.join(', ')}) VALUES (${placeholders(FILE_COLUMNS.length)})
       ON CONFLICT (id) DO UPDATE SET ${updates}`,
      FILE_COLUMNS.map((c) => file[c] ?? null),
    );
  }

  // ---------- Bandeja de entrada ----------

  async addInbox(item: {
    kind: InboxKind;
    input?: string | null;
    image_path?: string | null;
  }): Promise<InboxItem> {
    const t = now();
    const inbox: InboxItem = {
      id: uuidv7(),
      kind: item.kind,
      input: item.input ?? null,
      image_path: item.image_path ?? null,
      candidates: [],
      state: 'pending',
      book_id: null,
      created_at: t,
      updated_at: t,
      method: null,
      queries: [],
      identified_at: null,
      error: null,
    };
    await this.db.run(
      `INSERT INTO inbox (id, kind, input, image_path, candidates, state, book_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, '[]', 'pending', NULL, ?, ?)`,
      [inbox.id, inbox.kind, inbox.input, inbox.image_path, t, t],
    );
    this.changed();
    return inbox;
  }

  async listInbox(state: InboxState = 'pending'): Promise<InboxItem[]> {
    const rows = await this.db.all('SELECT * FROM inbox WHERE state = ? ORDER BY created_at DESC', [
      state,
    ]);
    return rows.map(toInbox);
  }

  async getInbox(id: string): Promise<InboxItem | undefined> {
    const row = await this.db.get('SELECT * FROM inbox WHERE id = ?', [id]);
    return row && toInbox(row);
  }

  /** Guarda lo que se encontró al identificar (o por qué falló) */
  async setInboxResult(
    id: string,
    result: {
      candidates: Candidate[];
      method: IdentifyMethod;
      queries: string[];
      error?: string | null;
    },
  ) {
    const t = now();
    await this.db.run(
      `UPDATE inbox SET candidates = ?, method = ?, queries = ?, error = ?, identified_at = ?,
       updated_at = ? WHERE id = ?`,
      [
        JSON.stringify(result.candidates),
        result.method,
        JSON.stringify(result.queries),
        result.error ?? null,
        t,
        t,
        id,
      ],
    );
    this.changed();
  }

  /** Para volver a identificar (por ejemplo, después de conectar la IA) */
  async resetInbox(id: string) {
    await this.db.run(
      `UPDATE inbox SET method = NULL, identified_at = NULL, error = NULL, updated_at = ? WHERE id = ?`,
      [now(), id],
    );
    this.changed();
  }

  async resolveInbox(id: string, state: Exclude<InboxState, 'pending'>, bookId?: string) {
    await this.db.run('UPDATE inbox SET state = ?, book_id = ?, updated_at = ? WHERE id = ?', [
      state,
      bookId ?? null,
      now(),
      id,
    ]);
    this.changed();
  }

  // ---------- Ajustes ----------

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      key,
    ]);
    return row ? (JSON.parse(row.value) as T) : fallback;
  }

  async setSetting(key: string, value: unknown) {
    await this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), now()],
    );
    this.changed();
  }

  /** Para quien importa un respaldo: refrescar la UI después */
  notify() {
    this.changed();
  }
}
