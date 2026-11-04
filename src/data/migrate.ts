// Migraciones por PRAGMA user_version: cada archivo corre una sola vez, en orden y en una transacción
import type { Db } from './driver';
import { splitSql } from './sql';
import init from './migrations/0001_init.sql?raw';
import inboxIdentify from './migrations/0002_inbox_identify.sql?raw';
import bookDescription from './migrations/0003_book_description.sql?raw';
import readingInfo from './migrations/0004_reading_info.sql?raw';

// Solo se agregan al final; nunca se edita una migración ya publicada
export const MIGRATIONS = [init, inboxIdentify, bookDescription, readingInfo];

export async function migrate(db: Db, migrations = MIGRATIONS) {
  await db.exec('PRAGMA foreign_keys = ON');
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > migrations.length) {
    throw new Error(
      `La base es de una versión más nueva de la app (${current} > ${migrations.length})`,
    );
  }
  for (let v = current; v < migrations.length; v++) {
    await db.transaction(async (tx) => {
      // De a una sentencia: el plugin nativo se salta sentencias si recibe varias con comentarios
      for (const statement of splitSql(migrations[v])) await tx.exec(statement);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  if (migrations === MIGRATIONS) await checkSchema(db);
  return migrations.length;
}

// Columnas que el código usa. Si una migración quedó a medias, mejor fallar al abrir que perder datos.
const REQUIRED: Record<string, string[]> = {
  books: [
    'id',
    'title',
    'description',
    'up_next',
    'current_page',
    'info',
    'status',
    'position',
    'search_text',
    'updated_at',
    'deleted_at',
  ],
  files: ['id', 'book_id', 'sha256', 'updated_at', 'deleted_at'],
  inbox: ['id', 'kind', 'candidates', 'state', 'method', 'queries', 'identified_at', 'error'],
  settings: ['key', 'value', 'updated_at'],
};

async function checkSchema(db: Db) {
  for (const [table, columns] of Object.entries(REQUIRED)) {
    const present = new Set(
      (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name),
    );
    const missing = columns.filter((c) => !present.has(c));
    if (missing.length) {
      throw new Error(`La base está incompleta: faltan ${missing.join(', ')} en ${table}`);
    }
  }
}
