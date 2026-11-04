// Metadatos y huella de un EPUB o PDF
import { sha256 as sha256Bytes } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { unzipSync } from 'fflate';

export interface FileMeta {
  title: string | null;
  author: string | null;
}

/**
 * Huella del contenido. Con @noble/hashes y no crypto.subtle: subtle solo existe en contextos
 * seguros, y en desarrollo el emulador carga la app desde http://10.0.2.2.
 */
export async function sha256(bytes: Uint8Array): Promise<string> {
  return bytesToHex(sha256Bytes(bytes));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === '#'
        ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : (ENTITIES[e] ?? m),
    );
}

/** El primer <dc:title> o <dc:creator> del OPF (con o sin prefijo de namespace) */
function dcField(xml: string, tag: string): string | null {
  const m = xml.match(
    new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'i'),
  );
  const value = m ? decodeXml(m[1]).replace(/\s+/g, ' ').trim() : '';
  return value || null;
}

/** Lee título y autor del OPF de un EPUB, sin descomprimir el resto del libro */
export function readEpubMeta(bytes: Uint8Array): FileMeta {
  const empty = { title: null, author: null };
  try {
    const decoder = new TextDecoder();
    const container = unzipSync(bytes, {
      filter: (f) => f.name === 'META-INF/container.xml',
    })['META-INF/container.xml'];
    if (!container) return empty;
    const opfPath = decoder.decode(container).match(/full-path="([^"]+)"/)?.[1];
    if (!opfPath) return empty;
    const opf = unzipSync(bytes, { filter: (f) => f.name === opfPath })[opfPath];
    if (!opf) return empty;
    const xml = decoder.decode(opf);
    return { title: dcField(xml, 'title'), author: dcField(xml, 'creator') };
  } catch {
    // EPUB raro o dañado: se guarda igual, sin metadatos
    return empty;
  }
}

/** "Brandon_Sanderson-Elantris.epub" → "Brandon Sanderson-Elantris" */
export const titleFromFilename = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim();

export function formatOf(name: string, mimeType = ''): 'epub' | 'pdf' | null {
  if (/\.epub$/i.test(name) || mimeType === 'application/epub+zip') return 'epub';
  if (/\.pdf$/i.test(name) || mimeType === 'application/pdf') return 'pdf';
  return null;
}

export function formatSize(bytes: number) {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1).replace('.0', '')} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}
