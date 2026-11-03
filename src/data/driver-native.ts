// Android/iOS: SQLite nativo. El archivo queda en databases/, que Android Auto Backup respalda
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { createDb, type Db, type Row } from './driver';

export async function openNativeDb(name: string): Promise<Db> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  // Si la página se recargó (live reload en desarrollo, o Android reiniciando el WebView), la conexión
  // nativa puede seguir abierta y con una transacción a medias que bloquea la base.
  // Se deshace (si no hay ninguna, el ROLLBACK falla y no pasa nada) y después se reconecta.
  await CapacitorSQLite.execute({
    database: name,
    statements: 'ROLLBACK',
    transaction: false,
  }).catch(() => {});
  await sqlite.checkConnectionsConsistency().catch(() => {});
  const exists = (await sqlite.isConnection(name, false)).result;
  const conn = exists
    ? await sqlite.retrieveConnection(name, false)
    : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  try {
    await conn.open();
  } catch (error) {
    // Bloqueada por una conexión anterior que se está cerrando: un reintento corto basta
    if (!/locked/i.test(String(error))) throw error;
    await new Promise((r) => setTimeout(r, 400));
    await conn.open();
  }

  // `transaction: false` en todo: las transacciones las maneja createDb con BEGIN/COMMIT
  return createDb({
    async exec(sql) {
      await conn.execute(sql, false);
    },
    async all(sql, params = []) {
      return ((await conn.query(sql, params)).values ?? []) as Row[];
    },
    async run(sql, params = []) {
      return (await conn.run(sql, params, false)).changes?.changes ?? 0;
    },
    async close() {
      await conn.close();
      await sqlite.closeConnection(name, false);
    },
  });
}
