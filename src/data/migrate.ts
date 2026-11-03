// Migraciones por PRAGMA user_version: cada archivo corre una sola vez, en orden y en una transacción
import type { Db } from './driver';
import init from './migrations/0001_init.sql?raw';

// Solo se agregan al final; nunca se edita una migración ya publicada
export const MIGRATIONS = [init];

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
      await tx.exec(migrations[v]);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return migrations.length;
}
