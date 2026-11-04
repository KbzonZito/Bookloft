import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candidate } from '../data';

const book = (title: string, extra: Partial<Candidate> = {}): Candidate => ({
  title,
  authors: ['Autora'],
  year: null,
  cover_url: null,
  ol_key: `/works/${title}`,
  isbn: null,
  pages: null,
  ...extra,
});

const ol = vi.hoisted(() => ({
  byIsbn: vi.fn(),
  lookup: vi.fn(),
  search: vi.fn(),
}));
const ai = vi.hoisted(() => ({ extractBooks: vi.fn() }));

vi.mock('./openlibrary', async (orig) => ({ ...(await orig<object>()), ...ol }));
vi.mock('./ai', async (orig) => ({ ...(await orig<object>()), ...ai }));
// Google Books no se consulta en los tests: lo que Open Library no tiene, no aparece
vi.mock('./googlebooks', () => ({
  googleSearch: vi.fn(async () => []),
  googleByIsbn: vi.fn(async () => null),
  googleLookup: vi.fn(async () => null),
}));
vi.mock('./covers', () => ({ appleCovers: vi.fn(async () => []) }));
vi.mock('./images', () => ({
  readInboxImage: vi.fn(async () => 'BASE64'),
  inboxImageUri: vi.fn(),
}));
vi.mock('@capacitor-mlkit/text-recognition', () => ({ TextRecognition: {} }));

const { identify } = await import('./identify');
const { AiError } = await import('./ai');

beforeEach(() => {
  vi.clearAllMocks();
  ol.search.mockImplementation(async (q: string) => [book(q)]);
});

describe('identify', () => {
  it('un ISBN en el texto gana: no gasta IA', async () => {
    ol.byIsbn.mockResolvedValue(book('Elantris', { isbn: '9780765350374' }));
    const r = await identify({ text: 'ISBN 978-0-7653-5037-4', imagePath: null, apiKey: 'sk' });
    expect(r).toMatchObject({ method: 'isbn', error: null });
    expect(r.candidates[0].title).toBe('Elantris');
    expect(ai.extractBooks).not.toHaveBeenCalled();
  });

  it('con key, la IA propone y Open Library completa la ficha', async () => {
    ai.extractBooks.mockResolvedValue([
      { title: 'Piranesi', author: 'Susanna Clarke' },
      { title: 'Libro raro', author: null },
    ]);
    ol.lookup.mockImplementation(async (title: string) =>
      title === 'Piranesi' ? book('Piranesi') : null,
    );
    const r = await identify({ text: null, imagePath: 'inbox/a.jpg', apiKey: 'sk' });
    expect(r.method).toBe('ai');
    expect(ai.extractBooks).toHaveBeenCalledWith('sk', {
      text: undefined,
      image: { data: 'BASE64', mediaType: 'image/jpeg' },
    });
    // El que Open Library no conoce se propone igual, sin portada
    expect(r.candidates.map((c) => [c.title, c.ol_key])).toEqual([
      ['Piranesi', '/works/Piranesi'],
      ['Libro raro', null],
    ]);
  });

  it('si la IA falla, sigue buscando por el texto y avisa por qué', async () => {
    ai.extractBooks.mockRejectedValue(new AiError('invalid_key', '401'));
    const r = await identify({
      text: 'Terminé «El nombre del viento»',
      imagePath: null,
      apiKey: 'sk',
    });
    expect(r).toMatchObject({ method: 'search', error: 'invalid_key' });
    expect(r.queries[0]).toBe('El nombre del viento');
    expect(r.candidates[0].title).toBe('El nombre del viento');
  });

  it('sin key ni texto útil no inventa nada', async () => {
    const r = await identify({ text: '#booktok @alguien', imagePath: null, apiKey: null });
    expect(r).toEqual({ candidates: [], method: 'none', queries: [], error: null });
    expect(ol.search).not.toHaveBeenCalled();
  });
});
