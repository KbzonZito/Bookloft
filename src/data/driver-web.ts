// Navegador: sql.js con el archivo de la base guardado en IndexedDB
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import { createDb, type Db } from './driver';
import { sqljsDriver } from './driver-sqljs';

const IDB_NAME = 'biblioteca';
const STORE = 'files';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load(key: string): Promise<Uint8Array | undefined> {
  const store = (await idb()).transaction(STORE).objectStore(STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as Uint8Array | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function save(key: string, bytes: Uint8Array) {
  const tx = (await idb()).transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(bytes, key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function openWebDb(name: string): Promise<Db> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const database = new SQL.Database(await load(name));
  const persist = async () => {
    await save(name, database.export());
    // export() puede dejar las claves foráneas apagadas en sql.js
    database.exec('PRAGMA foreign_keys = ON');
  };
  const db = createDb(sqljsDriver(database), { persist });
  // Si se cierra o se oculta la pestaña antes del debounce, guardar igual (en la cola,
  // para no exportar a mitad de una transacción)
  addEventListener('pagehide', () => void db.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void db.flush();
  });
  return db;
}
