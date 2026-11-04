// Completar datos y portadas en segundo plano (después de importar notas, o a pedido).
// Vive fuera de los componentes: sigue aunque se cambie de pantalla, y la UI solo mira el progreso.
import { useSyncExternalStore } from 'react';
import type { Book, Library } from '../data';
import { completeBook } from '../sources/covers';

export interface EnrichProgress {
  done: number;
  total: number;
}

let progress: EnrichProgress | null = null;
const listeners = new Set<() => void>();
const queue: string[] = [];
let running = false;

function emit(next: EnrichProgress | null) {
  progress = next;
  for (const l of listeners) l();
}

export const needsData = (b: Book) =>
  !b.authors.length || (!b.cover_url && !b.cover_path) || !b.ol_key;

/** Agrega libros a la cola; si ya hay una corriendo, se suman a la misma */
export function enrichBooks(lib: Library, books: Book[]) {
  const fresh = books.filter((b) => needsData(b) && !queue.includes(b.id)).map((b) => b.id);
  if (!fresh.length) return;
  queue.push(...fresh);
  emit({ done: progress?.done ?? 0, total: (progress?.total ?? 0) + fresh.length });
  if (!running) void run(lib);
}

async function run(lib: Library) {
  running = true;
  // De a tres: Open Library corta si llegan muchas consultas juntas
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const book = await lib.getBook(id).catch(() => undefined);
      if (book && !book.deleted_at) await completeBook(lib, book).catch(() => 0);
      emit({ done: (progress?.done ?? 0) + 1, total: progress?.total ?? 1 });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  running = false;
  emit(null);
}

export function useEnrichProgress() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    () => progress,
  );
}
