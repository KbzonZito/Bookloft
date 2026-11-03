// Android/iOS: SQLite nativo. El archivo queda en databases/, que Android Auto Backup respalda
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { createDb, type Db, type Row } from './driver';

export async function openNativeDb(name: string): Promise<Db> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  // Después de un live reload la conexión puede seguir abierta en el lado nativo
  await sqlite.checkConnectionsConsistency().catch(() => {});
  const exists = (await sqlite.isConnection(name, false)).result;
  const conn = exists
    ? await sqlite.retrieveConnection(name, false)
    : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await conn.open();

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
