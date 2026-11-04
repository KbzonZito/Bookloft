// Leer pantallazos y textos con Claude, usando la API key de cada usuario.
// La key vive en el Keystore de Android / Keychain de iOS: nunca en SQLite ni en los respaldos.
// El SDK pesa más que el resto de la app junto: se carga recién la primera vez que se usa la IA
import type Anthropic from '@anthropic-ai/sdk';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

// Haiku 5.5: ~0,0003 USD por pantallazo; el más barato que lee bien portadas y lomos.
const AI_MODEL = 'claude-haiku-5-5';
const KEY_NAME = 'anthropic_api_key';

export interface ExtractedBook {
  title: string;
  author: string | null;
}

export interface ExtractInput {
  text?: string;
  image?: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' };
}

const SYSTEM = `Identificas libros en publicaciones de redes sociales (posts, reels, pantallazos, descripciones).
Devuelve TODOS los libros mencionados o que se vean (portadas, lomos en una repisa, listas), con su título y autor.
- Revisa la imagen completa: en una foto de una repisa o de una pila, cada lomo es un libro; no te saltes ninguno.
- Usa el título tal como se ve, en el idioma en que aparece; no lo traduzcas.
- Si el autor no se lee pero conoces el libro con certeza, escríbelo; si no, déjalo en null.
- Si el título incluye la saga (por ejemplo "Libro 2 de..."), deja solo el título del libro.
- No inventes libros: si no hay ninguno claro, devuelve una lista vacía.
- Ignora hashtags, nombres de cuentas y textos promocionales que no sean libros.`;

const SCHEMA = {
  type: 'object',
  properties: {
    books: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          author: { type: ['string', 'null'] },
        },
        required: ['title', 'author'],
        additionalProperties: false,
      },
    },
  },
  required: ['books'],
  additionalProperties: false,
};

export async function getApiKey(): Promise<string | null> {
  const value = await SecureStorage.get(KEY_NAME).catch(() => null);
  return typeof value === 'string' && value ? value : null;
}

export async function setApiKey(key: string | null) {
  if (key) await SecureStorage.set(KEY_NAME, key.trim());
  else await SecureStorage.remove(KEY_NAME);
}

/** Errores que la UI sabe explicar */
export type AiErrorKind = 'invalid_key' | 'no_credit' | 'rate_limited' | 'network' | 'other';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
  }
}

let SDK: typeof Anthropic | null = null;

async function client(apiKey: string) {
  SDK ??= (await import('@anthropic-ai/sdk')).default;
  // La key es del propio usuario y solo viaja a api.anthropic.com desde su dispositivo
  return new SDK({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 45_000 });
}

function toAiError(error: unknown): AiError {
  const Anthropic = SDK;
  if (!Anthropic) return new AiError('other', String(error));
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new AiError('invalid_key', error.message);
  }
  if (error instanceof Anthropic.RateLimitError) return new AiError('rate_limited', error.message);
  if (error instanceof Anthropic.BadRequestError && /credit|billing/i.test(error.message)) {
    return new AiError('no_credit', error.message);
  }
  if (error instanceof Anthropic.APIConnectionError) return new AiError('network', error.message);
  if (error instanceof Anthropic.APIError) return new AiError('other', error.message);
  return new AiError('other', error instanceof Error ? error.message : String(error));
}

/** Pide a Claude la lista de libros que aparecen en un texto y/o una imagen */
export async function extractBooks(apiKey: string, input: ExtractInput): Promise<ExtractedBook[]> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.image) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: input.image.mediaType, data: input.image.data },
    });
  }
  content.push({
    type: 'text',
    text: input.text
      ? `Contenido compartido:\n\n${input.text}`
      : '¿Qué libros aparecen en esta imagen?',
  });

  try {
    const response = await (
      await client(apiKey)
    ).messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      // Una imagen pide mirar con más cuidado (lomos chicos, repisas): con esfuerzo bajo se saltaba libros
      output_config: {
        effort: input.image ? 'medium' : 'low',
        format: { type: 'json_schema', schema: SCHEMA },
      },
    });
    // Haiku 5.5 no tiene modelo de respaldo: si se niega, no hay libros que proponer
    if (response.stop_reason === 'refusal') return [];
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return [];
    const parsed = JSON.parse(text.text) as { books: ExtractedBook[] };
    return parsed.books.filter((b) => b.title.trim());
  } catch (error) {
    throw toAiError(error);
  }
}

/** Comprueba una key con la llamada más barata posible */
export async function testApiKey(apiKey: string): Promise<void> {
  try {
    await (
      await client(apiKey)
    ).messages.create({
      model: AI_MODEL,
      max_tokens: 16,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Responde solo: ok' }],
    });
  } catch (error) {
    throw toAiError(error);
  }
}

export interface SeriesGuess {
  id: string;
  series: string | null;
  index: number | null;
}

const SERIES_SYSTEM = `Eres bibliotecario. Para cada libro de la lista, indica la saga o serie a la que pertenece y su número de orden dentro de ella.
- Usa el nombre más conocido de la saga, en el mismo idioma del título del libro (Mistborn / Nacidos de la bruma).
- Para el número usa el orden de publicación habitual; las novelas cortas o precuelas pueden llevar decimales (2.5).
- Si el libro es autoconclusivo o no estás seguro, devuelve series null e index null. No inventes.
- Devuelve exactamente un elemento por cada id recibido.`;

const SERIES_SCHEMA = {
  type: 'object',
  properties: {
    books: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          series: { type: ['string', 'null'] },
          index: { type: ['number', 'null'] },
        },
        required: ['id', 'series', 'index'],
        additionalProperties: false,
      },
    },
  },
  required: ['books'],
  additionalProperties: false,
};

/** Pregunta a Claude a qué saga pertenece cada libro (de a 60 por llamada) */
export async function inferSeries(
  apiKey: string,
  books: { id: string; title: string; author: string | null }[],
): Promise<SeriesGuess[]> {
  const out: SeriesGuess[] = [];
  for (let i = 0; i < books.length; i += 60) {
    const chunk = books.slice(i, i + 60);
    const list = chunk.map((b) => `${b.id} | ${b.title} | ${b.author ?? '?'}`).join('\n');
    try {
      const response = await (
        await client(apiKey)
      ).messages.create({
        model: AI_MODEL,
        max_tokens: 8000,
        system: SERIES_SYSTEM,
        messages: [{ role: 'user', content: `id | título | autor\n${list}` }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: SERIES_SCHEMA } },
      });
      const text = response.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') continue;
      const ids = new Set(chunk.map((b) => b.id));
      const parsed = JSON.parse(text.text) as { books: SeriesGuess[] };
      out.push(...parsed.books.filter((g) => ids.has(g.id)));
    } catch (error) {
      throw toAiError(error);
    }
  }
  return out;
}

// ---------- ¿Qué leo ahora? ----------

export interface NextPick {
  id: string;
  reason: string;
}

const NEXT_SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
        required: ['id', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['picks'],
  additionalProperties: false,
};

/**
 * Pide a Claude 3 libros para leer ahora, entre los candidatos que ya ordenó la app, mirando lo
 * que la persona leyó hace poco (y cómo lo calificó) y lo que está leyendo.
 */
export async function suggestWithAi(
  apiKey: string,
  input: {
    lang: 'es' | 'en';
    candidates: { id: string; line: string }[];
    recent: string[];
    reading: string[];
  },
): Promise<NextPick[]> {
  const system = `Eres un librero que conoce a esta persona por lo que ha leído. Elige exactamente 3 libros de la lista de candidatos para que lea ahora.
- Considera lo que leyó hace poco y su calificación (1–5), lo que está leyendo, y las pistas de cada candidato (saga en curso, prioridad, páginas).
- Varía: no elijas 3 del mismo autor ni del mismo género si hay alternativas razonables.
- Para cada uno, una razón breve y personal (máximo 20 palabras), en ${input.lang === 'es' ? 'español' : 'English'}, sin repetir el título.
- Usa solo ids de la lista de candidatos.`;
  const content = [
    `Leídos hace poco (más reciente primero):\n${input.recent.join('\n') || '(nada todavía)'}`,
    `Leyendo ahora:\n${input.reading.join('\n') || '(nada)'}`,
    `Candidatos (id | libro | pistas):\n${input.candidates.map((c) => `${c.id} | ${c.line}`).join('\n')}`,
  ].join('\n\n');
  try {
    const response = await (
      await client(apiKey)
    ).messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: NEXT_SCHEMA } },
    });
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return [];
    const ids = new Set(input.candidates.map((c) => c.id));
    const { picks } = JSON.parse(text.text) as { picks: NextPick[] };
    return picks.filter((p) => ids.has(p.id)).slice(0, 3);
  } catch (error) {
    throw toAiError(error);
  }
}
