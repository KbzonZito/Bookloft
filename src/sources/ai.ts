// Leer pantallazos y textos con Claude, usando la API key de cada usuario (adaptado de book_app/src/worker/ai.ts).
// La key vive en el Keystore de Android / Keychain de iOS: nunca en SQLite ni en los respaldos.
import Anthropic from '@anthropic-ai/sdk';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

// Haiku 5.5: ~0,0003 USD por pantallazo. Lo eligió el usuario en book_app por costo.
export const AI_MODEL = 'claude-haiku-5-5';
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
Devuelve cada libro mencionado o cuya portada se vea, con su título y autor si se conoce.
- Usa el título tal como se ve; si es una traducción conocida, prefiere el título original.
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

function client(apiKey: string) {
  // La key es del propio usuario y solo viaja a api.anthropic.com desde su dispositivo
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 45_000 });
}

function toAiError(error: unknown): AiError {
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
    const response = await client(apiKey).messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
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
    await client(apiKey).messages.create({
      model: AI_MODEL,
      max_tokens: 16,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Responde solo: ok' }],
    });
  } catch (error) {
    throw toAiError(error);
  }
}
