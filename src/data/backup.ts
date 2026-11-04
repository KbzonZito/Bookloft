// Respaldo JSON v1: el mismo formato sirve para exportar, restaurar y fusionar bibliotecas
import type { Db } from './driver';
import { BOOK_COLUMNS, toBook, type Library } from './library';
import { now } from './ids';
import { STATUSES, type Book, type VaultFile } from './types';

export interface BackupSetting {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface BackupV1 {
  format: 'biblioteca';
  version: 1;
  app_version: string;
  exported_at: string;
  books: Book[];
  files: VaultFile[];
  settings: BackupSetting[];
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  invalid: number;
}

/** Incluye los borrados: así un libro eliminado en un equipo se elimina también al fusionar */
export async function exportJson(lib: Library, appVersion = 'dev'): Promise<BackupV1> {
  const books = (await lib.db.all('SELECT * FROM books ORDER BY added_at')).map(toBook);
  const files = await lib.db.all<VaultFile>('SELECT * FROM files ORDER BY added_at');
  const settings = (
    await lib.db.all<{ key: string; value: string; updated_at: string }>('SELECT * FROM settings')
  ).map((s) => ({ ...s, value: JSON.parse(s.value) }));
  return {
    format: 'biblioteca',
    version: 1,
    app_version: appVersion,
    exported_at: now(),
    books,
    files,
    settings,
  };
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isStringArray = (v: unknown) => Array.isArray(v) && v.every(isString);

function validBook(b: unknown): b is Book {
  if (!b || typeof b !== 'object') return false;
  const r = b as Record<string, unknown>;
  return (
    isString(r.id) &&
    isString(r.title) &&
    r.title.trim() !== '' &&
    isStringArray(r.authors) &&
    isStringArray(r.tags) &&
    STATUSES.includes(r.status as Book['status']) &&
    isString(r.added_at) &&
    isString(r.updated_at)
  );
}

function validFile(f: unknown): f is VaultFile {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  return (
    isString(r.id) &&
    isString(r.path) &&
    isString(r.filename) &&
    isString(r.sha256) &&
    typeof r.size === 'number' &&
    isString(r.updated_at)
  );
}

/**
 * Escribe una fila dentro de un SAVEPOINT: si rompe el esquema (calificación fuera de rango,
 * clave foránea, etc.) se deshace solo esa fila y la importación sigue con las demás.
 */
async function tryRow(tx: Db, write: () => Promise<void>): Promise<boolean> {
  await tx.exec('SAVEPOINT import_row');
  try {
    await write();
    await tx.exec('RELEASE import_row');
    return true;
  } catch {
    await tx.exec('ROLLBACK TO import_row');
    await tx.exec('RELEASE import_row');
    return false;
  }
}

export function parseBackup(data: unknown): BackupV1 {
  const d = data as Partial<BackupV1> | null;
  if (!d || d.format !== 'biblioteca') throw new Error('No es un respaldo de la biblioteca');
  if (d.version !== 1) throw new Error(`Versión de respaldo no soportada: ${String(d.version)}`);
  return {
    ...(d as BackupV1),
    books: Array.isArray(d.books) ? d.books : [],
    files: Array.isArray(d.files) ? d.files : [],
    settings: Array.isArray(d.settings) ? d.settings : [],
  };
}

/**
 * Fusiona un respaldo con lo que ya hay, fila por fila según su UUID:
 * gana la versión con `updated_at` más nuevo. Nunca borra filas; los borrados viajan como `deleted_at`.
 */
export async function importJson(lib: Library, data: unknown): Promise<ImportResult> {
  const backup = parseBackup(data);
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, invalid: 0 };

  await lib.db.transaction(async (tx) => {
    // Lo que ya hay, en una sola consulta: en el teléfono cada consulta cruza el puente nativo
    const bookVersions = new Map(
      (await tx.all<{ id: string; updated_at: string }>('SELECT id, updated_at FROM books')).map(
        (b) => [b.id, b.updated_at],
      ),
    );

    const toWrite: { book: Book; isNew: boolean }[] = [];
    for (const incoming of backup.books) {
      if (!validBook(incoming)) {
        result.invalid++;
        continue;
      }
      const currentVersion = bookVersions.get(incoming.id);
      if (currentVersion !== undefined && currentVersion >= incoming.updated_at) {
        result.skipped++;
        continue;
      }
      // Completa con null lo que falte (respaldos de versiones con menos columnas)
      const book = Object.fromEntries(
        BOOK_COLUMNS.map((c) => [c, (incoming as unknown as Record<string, unknown>)[c] ?? null]),
      ) as unknown as Book;
      toWrite.push({
        book: { ...book, priority: book.priority ?? 0 },
        isNew: currentVersion === undefined,
      });
    }

    // De a grupos; si un grupo rompe el esquema, ese grupo se reintenta libro por libro
    for (let i = 0; i < toWrite.length; i += 40) {
      const chunk = toWrite.slice(i, i + 40);
      if (
        await tryRow(tx, () =>
          lib.writeBooks(
            tx,
            chunk.map((c) => c.book),
          ),
        )
      ) {
        for (const c of chunk) result[c.isNew ? 'added' : 'updated']++;
        continue;
      }
      for (const c of chunk) {
        if (await tryRow(tx, () => lib.writeBook(tx, c.book)))
          result[c.isNew ? 'added' : 'updated']++;
        else result.invalid++;
      }
    }

    for (const incoming of backup.files) {
      if (!validFile(incoming)) {
        result.invalid++;
        continue;
      }
      const current = await tx.get<{ id: string; updated_at: string }>(
        'SELECT id, updated_at FROM files WHERE id = ? OR sha256 = ?',
        [incoming.id, incoming.sha256],
      );
      // El mismo archivo con otro ID (se agregó en los dos equipos): se queda el que ya estaba
      if (current && (current.id !== incoming.id || current.updated_at >= incoming.updated_at)) {
        result.skipped++;
        continue;
      }
      // Si su libro no está (no venía en el respaldo o era inválido), el archivo queda sin libro
      const bookExists =
        incoming.book_id != null &&
        (await tx.get('SELECT 1 FROM books WHERE id = ?', [incoming.book_id])) !== undefined;
      const file: VaultFile = {
        ...incoming,
        book_id: bookExists ? incoming.book_id : null,
        added_at: incoming.added_at ?? incoming.updated_at,
      };
      if (await tryRow(tx, () => lib.writeFile(tx, file))) {
        result[current ? 'updated' : 'added']++;
      } else {
        result.invalid++;
      }
    }

    for (const s of backup.settings) {
      if (!isString(s?.key) || !isString(s.updated_at)) continue;
      await tx.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
         WHERE excluded.updated_at > settings.updated_at`,
        [s.key, JSON.stringify(s.value), s.updated_at],
      );
    }
  });

  lib.notify();
  return result;
}
