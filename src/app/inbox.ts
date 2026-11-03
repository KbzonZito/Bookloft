// La bandeja de entrada: lo que se compartió a la app o se pegó, hasta que se agrega o se descarta
import { Capacitor } from '@capacitor/core';
import { CapacitorShareTarget } from '@capgo/capacitor-share-target';
import { useEffect, useState } from 'react';
import type { InboxItem, Library } from '../data';
import { getApiKey } from '../sources/ai';
import { identify } from '../sources/identify';
import { deleteInboxImage, saveInboxImage } from '../sources/images';
import { findUrls } from '../sources/text';
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

type ShareListener = () => void;
const shareListeners = new Set<ShareListener>();
let missedShare = false;

/** La UI abre la bandeja cuando llega algo; si todavía no escucha, se acuerda para después */
export function onShare(listener: ShareListener) {
  shareListeners.add(listener);
  if (missedShare) {
    missedShare = false;
    listener();
  }
  return () => void shareListeners.delete(listener);
}

/**
 * Escucha lo que llega por la hoja de compartir de Android. Hay que llamarlo al abrir la app:
 * el plugin guarda lo que llegó con la app cerrada hasta que alguien escucha.
 */
export function listenForShares(lib: Library) {
  if (!Capacitor.isNativePlatform()) return;
  void CapacitorShareTarget.addListener('shareReceived', async (event) => {
    const text = [event.title, ...event.texts].filter(Boolean).join('\n');
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
    if (shareListeners.size) for (const l of shareListeners) l();
    else missedShare = true;
  });
}
