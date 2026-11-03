import initSqlJs from 'sql.js';
import { describe, expect, it } from 'vitest';
import { createDb } from './driver';
import { sqljsDriver } from './driver-sqljs';
import { migrate, MIGRATIONS } from './migrate';
import { uuidv7 } from './ids';

const SQL = await initSqlJs();
const fresh = () => createDb(sqljsDriver(new SQL.Database()));

describe('migraciones', () => {
  it('crea el esquema desde cero y es idempotente', async () => {
    const db = fresh();
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    await migrate(db);
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(['books', 'files', 'inbox', 'settings']);
    expect((await db.get<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(1);
  });

  it('una migración que falla no deja nada a medias', async () => {
    const db = fresh();
    await expect(migrate(db, ['CREATE TABLE a (x); CREATE TABLE a (x);'])).rejects.toThrow(
      /already exists/,
    );
    expect(await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")).toEqual([]);
  });

  it('no abre una base de una versión más nueva de la app', async () => {
    const db = fresh();
    await db.exec('PRAGMA user_version = 99');
    await expect(migrate(db)).rejects.toThrow(/más nueva/);
  });
});

describe('uuidv7', () => {
  it('tiene el formato correcto y ordena por tiempo', () => {
    const a = uuidv7(1_000);
    const b = uuidv7(2_000);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});
