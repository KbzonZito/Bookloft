import { describe, expect, it } from 'vitest';
import inboxIdentify from './migrations/0002_inbox_identify.sql?raw';
import { splitSql } from './sql';

describe('splitSql', () => {
  it('separa sentencias y quita comentarios al final de la línea', () => {
    expect(splitSql(inboxIdentify)).toEqual([
      'ALTER TABLE inbox ADD COLUMN method TEXT',
      "ALTER TABLE inbox ADD COLUMN queries TEXT NOT NULL DEFAULT '[]'",
      'ALTER TABLE inbox ADD COLUMN identified_at TEXT',
      'ALTER TABLE inbox ADD COLUMN error TEXT',
    ]);
  });

  it('no corta dentro de un texto con ; o -- ni con comillas escapadas', () => {
    expect(splitSql("INSERT INTO t VALUES ('a;b -- c', 'it''s'); -- fin\nSELECT 1;")).toEqual([
      "INSERT INTO t VALUES ('a;b -- c', 'it''s')",
      'SELECT 1',
    ]);
  });
});
