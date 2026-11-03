// SQLite en WebAssembly (sql.js): lo usan el navegador del Mac y los tests
import type { Database, SqlValue } from 'sql.js';
import type { RawDriver, Row, Value } from './driver';

export function sqljsDriver(db: Database): RawDriver {
  return {
    async exec(sql) {
      db.exec(sql);
    },
    async all(sql, params = []) {
      const stmt = db.prepare(sql, params as SqlValue[]);
      const rows: Row[] = [];
      try {
        while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, Value>);
      } finally {
        stmt.free();
      }
      return rows;
    },
    async run(sql, params = []) {
      db.run(sql, params as SqlValue[]);
      return db.getRowsModified();
    },
    async close() {
      db.close();
    },
  };
}
