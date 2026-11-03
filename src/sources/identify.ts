// De lo que se compartió (texto, link o pantallazo) a libros candidatos, de lo más exacto a lo más difuso:
// ISBN → IA con la key del usuario → OCR en el teléfono → búsqueda por las líneas más probables.
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { TextRecognition } from '@capacitor-mlkit/text-recognition';
import type { Candidate, IdentifyMethod } from '../data';
import { AiError, extractBooks } from './ai';
import { inboxImageUri, readInboxImage } from './images';
import { byIsbn, lookup, mergeCandidates, search } from './openlibrary';
import { findIsbns, findUrls, guessQueries, titleLines, type OcrLine } from './text';

export interface IdentifyInput {
  text: string | null;
  imagePath: string | null;
  apiKey: string | null;
}

export interface IdentifyResult {
  candidates: Candidate[];
  method: IdentifyMethod;
  queries: string[];
  /** La IA falló pero se siguió sin ella */
  error: string | null;
}

const native = Capacitor.isNativePlatform();

/**
 * Título y descripción de una página (og:title, og:description). Desde el teléfono, con HTTP nativo:
 * Instagram bloquea a los servidores, pero a veces responde a una IP residencial.
 */
async function pageText(url: string): Promise<string | null> {
  if (!native) return null;
  try {
    const res = await CapacitorHttp.get({
      url,
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile' },
      connectTimeout: 8000,
      readTimeout: 8000,
    });
    if (typeof res.data !== 'string') return null;
    const doc = new DOMParser().parseFromString(res.data, 'text/html');
    const meta = (p: string) =>
      doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute('content') ?? '';
    const text = [meta('og:title'), meta('og:description')].filter(Boolean).join('\n');
    // La página de inicio de sesión no dice nada útil
    return text && !/log ?in|inicia sesión|sign up/i.test(text) ? text : null;
  } catch {
    return null;
  }
}

async function ocr(imagePath: string): Promise<{ text: string; lines: OcrLine[] } | null> {
  if (!native) return null;
  try {
    const result = await TextRecognition.processImage({ path: await inboxImageUri(imagePath) });
    const lines = result.blocks.flatMap((b) =>
      b.lines.map((l) => ({
        text: l.text,
        height: l.boundingBox ? l.boundingBox.bottom - l.boundingBox.top : 0,
        top: l.boundingBox?.top ?? 0,
      })),
    );
    return { text: result.text, lines };
  } catch {
    return null;
  }
}

async function searchAll(queries: string[]): Promise<Candidate[]> {
  // La primera búsqueda es la más probable: trae más resultados y va primero
  const lists = await Promise.all(
    queries.map((q, i) => search(q, i === 0 ? 6 : 3).catch(() => [])),
  );
  return mergeCandidates(lists);
}

async function fromIsbns(isbns: string[]): Promise<Candidate[]> {
  const found = await Promise.all(isbns.slice(0, 3).map((i) => byIsbn(i).catch(() => null)));
  return found.filter((c): c is Candidate => c !== null);
}

const aiMessage = (e: unknown) => (e instanceof AiError ? e.kind : 'other');

export async function identify({
  text,
  imagePath,
  apiKey,
}: IdentifyInput): Promise<IdentifyResult> {
  let shared = text ?? '';

  // Un link solo dice algo si se lee la página
  for (const url of findUrls(shared).slice(0, 1)) {
    const page = await pageText(url);
    if (page) shared = `${shared}\n${page}`;
  }

  // 1. ISBN en el texto: exacto y gratis
  const isbnHits = await fromIsbns(findIsbns(shared));
  if (isbnHits.length) {
    return { candidates: isbnHits, method: 'isbn', queries: findIsbns(shared), error: null };
  }

  // 2. IA con la key del usuario: lee portadas y textos largos
  let error: string | null = null;
  if (apiKey) {
    try {
      const image = imagePath
        ? { data: await readInboxImage(imagePath), mediaType: 'image/jpeg' as const }
        : undefined;
      const books = await extractBooks(apiKey, { text: shared || undefined, image });
      const resolved = await Promise.all(
        books.slice(0, 6).map(async (b) => {
          const found = await lookup(b.title, b.author).catch(() => null);
          // Si Open Library no lo conoce, igual se propone con lo que leyó la IA
          return (
            found ?? {
              title: b.title,
              authors: b.author ? [b.author] : [],
              year: null,
              cover_url: null,
              ol_key: null,
              isbn: null,
              pages: null,
            }
          );
        }),
      );
      const queries = books.map((b) => [b.title, b.author].filter(Boolean).join(' '));
      if (resolved.length) {
        return { candidates: mergeCandidates([resolved]), method: 'ai', queries, error: null };
      }
    } catch (e) {
      error = aiMessage(e);
    }
  }

  // 3. Sin IA: el OCR del teléfono lee la imagen; las líneas más grandes suelen ser el título
  const queries: string[] = [];
  let method: IdentifyMethod = 'search';
  if (imagePath) {
    const read = await ocr(imagePath);
    if (read) {
      const ocrIsbn = await fromIsbns(findIsbns(read.text));
      if (ocrIsbn.length) return { candidates: ocrIsbn, method: 'isbn', queries: [], error };
      queries.push(...titleLines(read.lines, 3));
      method = 'ocr';
    }
  }
  if (shared.trim()) queries.push(...guessQueries(shared, 3));

  const unique = [...new Set(queries)].slice(0, 4);
  if (!unique.length) return { candidates: [], method: 'none', queries: [], error };
  return { candidates: await searchAll(unique), method, queries: unique, error };
}
