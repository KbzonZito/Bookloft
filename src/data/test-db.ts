// Base SQLite en memoria para los tests: el mismo motor y el mismo SQL que en el teléfono
import initSqlJs from 'sql.js';
import { createDb } from './driver';
import { sqljsDriver } from './driver-sqljs';
import { Library } from './library';
import { migrate } from './migrate';

const SQL = await initSqlJs();

export async function openTestLibrary() {
  const db = createDb(sqljsDriver(new SQL.Database()));
  await migrate(db);
  return new Library(db);
}
