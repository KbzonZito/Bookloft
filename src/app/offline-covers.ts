// Portadas sin conexión (opcional, en Ajustes): una copia chica de cada portada en el teléfono.
// ~15–20 KB por libro (≈10 MB con 600 libros). Es caché: se rehace sola, no va en los respaldos
// ni en el Auto Backup de Android, y se borra entera al apagar la opción.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { useSyncExternalStore } from 'react';
import type { Book, Library } from '../data';

const DIR = 'cover-cache';
const SETTING = 'offline_covers';
const MAX_SIDE = 360;

export const offlineSupported = Capacitor.isNativePlatform();

let enabled = false;
let dataDir: string | null = null;
const cached = new Set<string>();

interface State {
  enabled: boolean;
  /** Descargando: cuántas van y cuántas faltan */
  progress: { done: number; total: number } | null;
}
let state: State = { enabled: false, progress: null };
const listeners = new Set<() => void>();
const emit = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

export const useOfflineCovers = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => state,
  );

/** Nombre de archivo estable para una URL (FNV-1a, sin depender de crypto) */
function fileFor(url: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 0x01000193);
  return `${(h >>> 0).toString(16)}-${url.length}.jpg`;
}

/** Al abrir la app: si la opción está activa, qué portadas ya están guardadas */
export async function initOfflineCovers(lib: Library) {
  if (!offlineSupported) return;
  enabled = await lib.getSetting(SETTING, false);
  emit({ enabled });
  if (!enabled) return;
  dataDir = (await Filesystem.getUri({ path: '', directory: Directory.Data })).uri.replace(
    /\/$/,
    '',
  );
  const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Data }).catch(
    () => ({
      files: [],
    }),
  );
  for (const f of files) cached.add(f.name);
}

/** La copia local de una portada de internet, si existe */
export function offlineCoverSrc(url: string): string | null {
  if (!enabled || !dataDir) return null;
  const name = fileFor(url);
  return cached.has(name) ? Capacitor.convertFileSrc(`${dataDir}/${DIR}/${name}`) : null;
}

async function shrink(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
}

async function save(url: string) {
  const name = fileFor(url);
  if (cached.has(name)) return;
  // La misma URL que usa la cuadrícula (tamaño M en Open Library)
  const src = url.includes('covers.openlibrary.org')
    ? `${url.replace(/-[SML]\.jpg/, '-M.jpg')}?default=false`
    : url;
  const res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return;
  const data = await shrink(await res.blob());
  await Filesystem.writeFile({
    path: `${DIR}/${name}`,
    data,
    directory: Directory.Data,
    recursive: true,
  });
  cached.add(name);
}

let running = false;

/** Descarga las portadas que falten (de a tres). Se puede llamar seguido: no repite trabajo. */
export async function syncOfflineCovers(lib: Library, books?: Book[]) {
  if (!enabled || running) return;
  running = true;
  try {
    const all = books ?? (await lib.listBooks());
    const missing = [
      ...new Set(all.filter((b) => b.cover_url && !b.cover_path).map((b) => b.cover_url!)),
    ].filter((u) => !cached.has(fileFor(u)));
    if (!missing.length) return;
    let done = 0;
    emit({ progress: { done, total: missing.length } });
    const worker = async () => {
      for (let url = missing.shift(); url; url = missing.shift()) {
        await save(url).catch(() => {});
        emit({ progress: { done: ++done, total: state.progress?.total ?? done } });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  } finally {
    running = false;
    emit({ progress: null });
  }
}

export async function setOfflineCovers(lib: Library, on: boolean) {
  await lib.setSetting(SETTING, on);
  if (on) {
    await initOfflineCovers(lib);
    void syncOfflineCovers(lib);
  } else {
    enabled = false;
    cached.clear();
    emit({ enabled: false, progress: null });
    await Filesystem.rmdir({ path: DIR, directory: Directory.Data, recursive: true }).catch(
      () => {},
    );
  }
}

/** Cuánto ocupan las portadas guardadas */
export async function offlineCoversSize(): Promise<{ files: number; bytes: number }> {
  const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Data }).catch(
    () => ({
      files: [],
    }),
  );
  return { files: files.length, bytes: files.reduce((n, f) => n + (f.size ?? 0), 0) };
}
