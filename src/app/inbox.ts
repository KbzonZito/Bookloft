// La bandeja de entrada: lo que se compartió a la app o se pegó, hasta que se agrega o se descarta
import { Capacitor } from '@capacitor/core';
import { CapacitorShareTarget } from '@capgo/capacitor-share-target';
import { useEffect, useState } from 'react';
import type { InboxItem, Library } from '../data';
import { getApiKey } from '../sources/ai';
import { identify } from '../sources/identify';
import { deleteInboxImage, saveInboxImage } from '../sources/images';
import { formatOf } from '../sources/epub';
import { findUrls } from '../sources/text';
import { importToVault } from '../sources/vault';
import { useLibrary } from './library';

/** Crea un elemento de la bandeja con un texto, un link y/o una imagen */
export async function addToInbox(
  lib: Library,
  { text, image }: { text?: string | null; image?: { path: string; mimeType: string } | Blob },
): Promise<InboxItem> {
  const clean = text?.trim() || null;
  const urls = clean ? findUrls(clean) : [];
  const kind = image ? 'image' : urls.length && urls.join(' ') === clean ? 'url' : 'text';
  const item = await lib.addInbox({ kind, input: clean });
  if (image) {
    const path = await saveInboxImage(item.id, image);
    await lib.db.run('UPDATE inbox SET image_path = ? WHERE id = ?', [path, item.id]);
    item.image_path = path;
    lib.notify();
  }
  return item;
}

const running = new Set<string>();

/** Identifica un elemento una sola vez; el resultado queda guardado */
export async function processInbox(lib: Library, id: string) {
  if (running.has(id)) return;
  running.add(id);
  try {
    const item = await lib.getInbox(id);
    if (!item || item.identified_at) return;
    const result = await identify({
      text: item.input,
      imagePath: item.image_path,
      apiKey: await getApiKey(),
    });
    await lib.setInboxResult(id, result);
  } finally {
    running.delete(id);
  }
}

export async function dismissInbox(lib: Library, item: InboxItem) {
  await lib.resolveInbox(item.id, 'dismissed');
  if (item.image_path) await deleteInboxImage(item.image_path);
}

export async function finishInbox(lib: Library, item: InboxItem, bookId: string) {
  await lib.resolveInbox(item.id, 'done', bookId);
  if (item.image_path) await deleteInboxImage(item.image_path);
}

export function usePendingInbox(): InboxItem[] {
  const lib = useLibrary();
  const [items, setItems] = useState<InboxItem[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => void lib.listInbox('pending').then((i) => alive && setItems(i));
    load();
    const stop = lib.onChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, [lib]);
  return items;
}

// ---------- Compartir desde otras apps ----------

/** Adónde fue a parar lo compartido: a la bandeja (posts, pantallazos) o a la bóveda (EPUB, PDF) */
export type ShareOutcome =
  { to: 'inbox' } | { to: 'vault'; files: { name: string; duplicate: boolean }[] };
type ShareListener = (outcome: ShareOutcome) => void;
const shareListeners = new Set<ShareListener>();
let missed: ShareOutcome | null = null;

/** La UI abre la bandeja o la bóveda cuando llega algo; si todavía no escucha, se acuerda */
export function onShare(listener: ShareListener) {
  shareListeners.add(listener);
  if (missed) {
    listener(missed);
    missed = null;
  }
  return () => void shareListeners.delete(listener);
}

function announce(outcome: ShareOutcome) {
  if (shareListeners.size) for (const l of shareListeners) l(outcome);
  else missed = outcome;
}

/**
 * Escucha lo que llega por la hoja de compartir de Android. Hay que llamarlo al abrir la app:
 * el plugin guarda lo que llegó con la app cerrada hasta que alguien escucha.
 */
export function listenForShares(lib: Library) {
  if (!Capacitor.isNativePlatform()) return;
  void CapacitorShareTarget.addListener('shareReceived', async (event) => {
    const text = [event.title, ...event.texts].filter(Boolean).join('\n');

    // EPUB y PDF van directo a la bóveda, vinculados a su libro si ya está en la biblioteca
    const docs = event.files.filter((f) => formatOf(f.name, f.mimeType));
    if (docs.length) {
      const books = await lib.listBooks();
      const files: { name: string; duplicate: boolean }[] = [];
      for (const f of docs) {
        try {
          const r = await importToVault(
            lib,
            { path: f.uri, name: f.name, mimeType: f.mimeType },
            { books },
          );
          files.push({ name: r.file.meta_title ?? r.file.filename, duplicate: r.duplicate });
        } catch (error) {
          console.error('No se pudo guardar el archivo compartido', error);
        }
      }
      if (files.length) announce({ to: 'vault', files });
      return;
    }

    const images = event.files.filter((f) => f.mimeType.startsWith('image/'));
    let added = 0;
    for (const f of images.slice(0, 5)) {
      try {
        await addToInbox(lib, { text, image: { path: f.uri, mimeType: f.mimeType } });
        added++;
      } catch (error) {
        // Una imagen que no se pudo leer no debe perder el texto que venía con ella
        console.error('No se pudo guardar la imagen compartida', error);
      }
    }
    if (!added && text.trim()) {
      await addToInbox(lib, { text });
      added++;
    }
    if (!added) return;
    announce({ to: 'inbox' });
  });
}
