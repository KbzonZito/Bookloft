// Pantallazos de la bandeja: se guardan reducidos en el almacenamiento de la app
// (la caché del plugin de compartir se borra sola) y se leen para el OCR o la IA.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { useEffect, useState } from 'react';

// Claude reduce las imágenes a ~1568 px de lado: más grande solo cuesta más y pesa más
const MAX_SIDE = 1568;

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Reduce y pasa a JPEG; devuelve el base64 sin el prefijo data: */
async function downscale(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.86).split(',')[1];
}

/** Copia una imagen (ruta nativa o Blob) a inbox/<id>.jpg y devuelve esa ruta relativa */
export async function saveInboxImage(
  id: string,
  source: { path: string; mimeType: string } | Blob,
): Promise<string> {
  let dataUrl: string;
  if (source instanceof Blob) {
    dataUrl = await readBlob(source);
  } else {
    const { data } = await Filesystem.readFile({ path: source.path });
    dataUrl =
      typeof data === 'string' ? `data:${source.mimeType};base64,${data}` : await readBlob(data);
  }
  const path = `inbox/${id}.jpg`;
  await Filesystem.writeFile({
    path,
    data: await downscale(dataUrl),
    directory: Directory.Data,
    recursive: true,
  });
  return path;
}

export async function readInboxImage(path: string): Promise<string> {
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
  return typeof data === 'string' ? data : (await readBlob(data)).split(',')[1];
}

/** Ruta file:// que entiende el OCR nativo */
export async function inboxImageUri(path: string): Promise<string> {
  return (await Filesystem.getUri({ path, directory: Directory.Data })).uri;
}

export async function deleteInboxImage(path: string) {
  await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => {});
}

/** URL para mostrar la imagen en un <img> */
export function useInboxImage(path: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = Capacitor.isNativePlatform()
      ? inboxImageUri(path).then((uri) => Capacitor.convertFileSrc(uri))
      : readInboxImage(path).then((b64) => `data:image/jpeg;base64,${b64}`);
    void load.then((s) => alive && setSrc(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);
  return src;
}
