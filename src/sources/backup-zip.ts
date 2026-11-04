// Respaldo en ZIP: biblioteca.json (fichas, bóveda, ajustes) y, en el respaldo completo, los EPUB/PDF.
// Se escribe y se lee archivo por archivo, para no tener toda la bóveda en memoria a la vez.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { inflateSync, strFromU8, strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { exportJson, importJson, type ImportResult, type Library } from '../data';
import { now } from '../data/ids';
import { concat, fromBase64, toBase64 } from './bytes';

const native = Capacitor.isNativePlatform();
const JSON_NAME = 'biblioteca.json';
// Los EPUB ya vienen comprimidos: se guardan tal cual, sin perder tiempo comprimiendo
const FLUSH_BYTES = 512 * 1024;

const LAST_BACKUP = 'last_backup_at';

/** Dónde se va escribiendo el ZIP: un archivo en la caché del teléfono o un Blob en el navegador */
interface Sink {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<{ uri?: string; blob?: Blob; size: number }>;
}

function nativeSink(path: string): Sink {
  let size = 0;
  let started = false;
  return {
    async write(chunk) {
      size += chunk.length;
      const data = toBase64(chunk);
      if (!started) {
        await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
        started = true;
      } else {
        await Filesystem.appendFile({ path, data, directory: Directory.Cache });
      }
    },
    async close() {
      return { uri: (await Filesystem.getUri({ path, directory: Directory.Cache })).uri, size };
    },
  };
}

function blobSink(): Sink {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  return {
    async write(chunk) {
      parts.push(chunk as Uint8Array<ArrayBuffer>);
      size += chunk.length;
    },
    async close() {
      return { blob: new Blob(parts, { type: 'application/zip' }), size };
    },
  };
}

export interface BackupFile {
  name: string;
  size: number;
  uri?: string;
  blob?: Blob;
  /** Archivos de la bóveda que no estaban en el teléfono y quedaron fuera */
  missing: number;
}

function backupName(withFiles: boolean, date = new Date()) {
  return `biblioteca-${withFiles ? 'completo-' : ''}${date.toISOString().slice(0, 10)}.zip`;
}

/** Arma el ZIP. Con withFiles incluye los EPUB/PDF de la bóveda (puede pesar mucho). */
export async function createBackup(
  lib: Library,
  { withFiles, appVersion = 'dev', sink }: { withFiles: boolean; appVersion?: string; sink?: Sink },
): Promise<BackupFile> {
  const name = backupName(withFiles);
  const out = sink ?? (native ? nativeSink(`backups/${name}`) : blobSink());

  // fflate entrega los pedazos de forma síncrona; se juntan y se escriben entre archivo y archivo
  let pending: Uint8Array[] = [];
  let pendingSize = 0;
  let failure: Error | null = null;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    pending.push(chunk);
    pendingSize += chunk.length;
  });
  const flush = async (force = false) => {
    if (failure) throw failure;
    if (!pending.length || (!force && pendingSize < FLUSH_BYTES)) return;
    const chunk = concat(pending);
    pending = [];
    pendingSize = 0;
    await out.write(chunk);
  };

  const backup = await exportJson(lib, appVersion);
  const json = new ZipDeflate(JSON_NAME, { level: 6 });
  zip.add(json);
  json.push(strToU8(JSON.stringify(backup)), true);
  await flush();

  const addFile = async (path: string) => {
    let bytes: Uint8Array;
    try {
      const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
      bytes =
        typeof data === 'string' ? fromBase64(data) : new Uint8Array(await data.arrayBuffer());
    } catch {
      return false;
    }
    const entry = new ZipPassThrough(path);
    zip.add(entry);
    entry.push(bytes, true);
    await flush();
    return true;
  };

  // Las portadas propias pesan poco y no se pueden volver a descargar: van en todo respaldo
  for (const book of backup.books) {
    if (book.cover_path?.startsWith('covers/')) await addFile(book.cover_path);
  }

  let missing = 0;
  if (withFiles) {
    for (const file of backup.files.filter((f) => !f.deleted_at)) {
      if (!(await addFile(file.path))) missing++;
    }
  }

  zip.end();
  await flush(true);
  const result = await out.close();
  return { name, missing, ...result };
}

/**
 * Comparte el ZIP (en Android: Drive, Gmail, Archivos…) o lo descarga en el navegador.
 * false si se cerró la hoja sin elegir; lanza si Android no pudo abrirla.
 */
export async function deliverBackup(lib: Library, file: BackupFile): Promise<boolean> {
  if (file.blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file.blob);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (file.uri) {
    try {
      await Share.share({ title: file.name, files: [file.uri] });
    } catch (error) {
      if (/cancel/i.test(String(error))) return false;
      throw error;
    }
  }
  await lib.setSetting(LAST_BACKUP, now());
  return true;
}

export interface RestoreResult extends ImportResult {
  /** EPUB/PDF que estaban en el ZIP y faltaban en el teléfono */
  filesRestored: number;
}

export class RestoreError extends Error {
  constructor(readonly kind: 'not_backup' | 'corrupt') {
    super(kind);
  }
}

// ---------- Lectura del ZIP por su índice ----------
// No se lee por partes de principio a fin: un EPUB es en sí un ZIP, y sin el tamaño de cada
// archivo un lector por partes confunde las marcas internas del EPUB con el archivo siguiente.
// El directorio central, al final del ZIP, trae el tamaño exacto y dónde empieza cada archivo.

interface ZipEntry {
  name: string;
  method: number; // 0 = guardado tal cual, 8 = deflate
  compressedSize: number;
  offset: number; // dónde empieza su encabezado local
}

async function bytesAt(blob: Blob, start: number, length: number) {
  return new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) =>
  (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

async function readZipIndex(zip: Blob): Promise<ZipEntry[]> {
  // El final del directorio central está en los últimos 22 bytes + un comentario de hasta 64 KB
  const tailLength = Math.min(zip.size, 22 + 0xffff);
  const tail = await bytesAt(zip, zip.size - tailLength, tailLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('no es un ZIP');
  const count = u16(tail, eocd + 10);
  const cdSize = u32(tail, eocd + 12);
  const cdOffset = u32(tail, eocd + 16);
  const cd = await bytesAt(zip, cdOffset, cdSize);

  const entries: ZipEntry[] = [];
  for (let i = 0, n = 0; n < count; n++) {
    if (u32(cd, i) !== 0x02014b50) throw new Error('índice dañado');
    const nameLength = u16(cd, i + 28);
    entries.push({
      method: u16(cd, i + 10),
      compressedSize: u32(cd, i + 20),
      offset: u32(cd, i + 42),
      name: strFromU8(cd.subarray(i + 46, i + 46 + nameLength)),
    });
    i += 46 + nameLength + u16(cd, i + 30) + u16(cd, i + 32);
  }
  return entries;
}

async function readZipEntry(zip: Blob, entry: ZipEntry): Promise<Uint8Array> {
  const header = await bytesAt(zip, entry.offset, 30);
  if (u32(header, 0) !== 0x04034b50) throw new Error('archivo dañado');
  const start = entry.offset + 30 + u16(header, 26) + u16(header, 28);
  const data = await bytesAt(zip, start, entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateSync(data);
  throw new Error(`compresión ${entry.method} no soportada`);
}

async function exists(path: string) {
  return Filesystem.stat({ path, directory: Directory.Data }).then(
    () => true,
    () => false,
  );
}

/**
 * Restaura un respaldo (ZIP o el JSON suelto de versiones anteriores). Fusiona con lo que ya hay:
 * nunca borra, y de cada libro gana la versión más nueva. Los archivos solo se escriben si faltan.
 */
export async function restoreBackup(
  lib: Library,
  source: Blob & { name?: string },
): Promise<RestoreResult> {
  const isJson = source.name?.toLowerCase().endsWith('.json') || source.type === 'application/json';
  if (isJson) {
    try {
      return { ...(await importJson(lib, JSON.parse(await source.text()))), filesRestored: 0 };
    } catch {
      throw new RestoreError('not_backup');
    }
  }

  let entries: ZipEntry[];
  try {
    entries = await readZipIndex(source);
  } catch {
    throw new RestoreError('corrupt');
  }
  const jsonEntry = entries.find((e) => e.name === JSON_NAME);
  if (!jsonEntry) throw new RestoreError('not_backup');

  let json: string;
  let filesRestored = 0;
  try {
    json = strFromU8(await readZipEntry(source, jsonEntry));
    // De a un archivo: solo uno de la bóveda está en memoria a la vez
    for (const entry of entries.filter((e) => /^(vault|covers)\/[^/]+$/.test(e.name))) {
      if (await exists(entry.name)) continue;
      await Filesystem.writeFile({
        path: entry.name,
        data: toBase64(await readZipEntry(source, entry)),
        directory: Directory.Data,
        recursive: true,
      });
      filesRestored++;
    }
  } catch {
    throw new RestoreError('corrupt');
  }

  try {
    return { ...(await importJson(lib, JSON.parse(json))), filesRestored };
  } catch {
    throw new RestoreError('not_backup');
  }
}

/** Para el recordatorio: ¿hace cuánto del último respaldo? (null = nunca) */
export async function daysSinceBackup(lib: Library): Promise<number | null> {
  const last = await lib.getSetting<string | null>(LAST_BACKUP, null);
  return last ? Math.floor((Date.now() - Date.parse(last)) / 86_400_000) : null;
}
