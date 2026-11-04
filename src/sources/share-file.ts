// Entregar un archivo generado por la app: en el teléfono, la hoja de compartir (Drive, Obsidian,
// correo, Archivos); en el navegador, una descarga.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Devuelve false si la persona cerró la hoja de compartir sin elegir nada */
export async function shareFile(name: string, data: Blob): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(data);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(data);
  });
  const { uri } = await Filesystem.writeFile({
    path: `share/${name}`,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });
  try {
    await Share.share({ title: name, files: [uri] });
    return true;
  } catch (error) {
    if (/cancel/i.test(String(error))) return false;
    throw error;
  }
}
