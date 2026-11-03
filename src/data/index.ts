// Abre la biblioteca del dispositivo: SQLite nativo en Android/iOS, WASM en el navegador
import { Capacitor } from '@capacitor/core';
import { Library } from './library';
import { migrate } from './migrate';

const DB_NAME = 'biblioteca';

export async function openLibrary(): Promise<Library> {
  const db = Capacitor.isNativePlatform()
    ? await (await import('./driver-native')).openNativeDb(DB_NAME)
    : await (await import('./driver-web')).openWebDb(DB_NAME);
  await migrate(db);
  return new Library(db);
}

export { Library } from './library';
export { exportJson, importJson, type BackupV1, type ImportResult } from './backup';
export * from './types';
