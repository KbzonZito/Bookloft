import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
  CapacitorHttp: {},
}));
const { toCandidate, googleCover } = await import('./googlebooks');
const { mergeSources } = await import('./books');

const volume = {
  id: 'x',
  volumeInfo: {
    title: 'The Sun Prince (Bonds of Kin Book 2)',
    authors: ['L.R. Schulz'],
    publishedDate: '2023-09-01',
    pageCount: 612,
    industryIdentifiers: [
      { type: 'ISBN_10', identifier: '0645457426' },
      { type: 'ISBN_13', identifier: '9780645457421' },
    ],
    imageLinks: {
      thumbnail:
        'http://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=5&edge=curl',
    },
  },
};

describe('Google Books', () => {
  it('lee título, saga, ISBN-13, páginas, año y portada', () => {
    expect(toCandidate(volume)).toEqual({
      title: 'The Sun Prince',
      authors: ['L.R. Schulz'],
      year: 2023,
      cover_url: 'https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1',
      ol_key: null,
      isbn: '9780645457421',
      pages: 612,
      series: 'Bonds of Kin',
      series_index: 2,
    });
    expect(googleCover({ id: 'y', volumeInfo: {} })).toBeNull();
  });

  it('al unir fuentes, Open Library va primero y no se repite el mismo libro', () => {
    const base = { year: null, cover_url: null, ol_key: null, isbn: null, pages: null };
    const ol = [
      { ...base, title: "A King's Radiance", authors: ['L.R. Schulz'], ol_key: '/works/1' },
    ];
    const google = [
      { ...base, title: "A King's Radiance", authors: ['Luke R. Schulz'] },
      { ...base, title: 'The Sun Prince', authors: ['L.R. Schulz'] },
    ];
    expect(mergeSources(ol, google).map((c) => c.title)).toEqual([
      "A King's Radiance",
      'The Sun Prince',
    ]);
  });
});
