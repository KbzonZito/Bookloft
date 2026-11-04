// Exportar la biblioteca a una nota Markdown para Obsidian, en un formato que la misma app vuelve a
// importar sin perder nada importante (ida y vuelta):
//
//   ---
//   formato: biblioteca
//   ---
//   # Brandon Sanderson
//   ## Nacidos de la bruma
//   - [x] 1. El imperio final (2006) — Mi favorito ★★★★½ #Cosmere
//   - [ ] 2. El pozo de la ascensión — #leyendo
//   ## Sin saga
//   - [ ] **Elantris (2005)** — Brandon Sanderson · #deseo #prioridad-alta
//
// Leído = [x]. Los demás estados, la prioridad y las etiquetas van como #etiquetas de Obsidian.
import { groupByAuthorAndSeries } from '../app/shelves';
import type { Book, Status } from './types';

export const EXPORT_MARK = 'formato: biblioteca';

export const STATUS_TAGS: Partial<Record<Status, string>> = {
  reading: 'leyendo',
  abandoned: 'sin-terminar',
};
export const PRIORITY_TAGS = ['', 'prioridad-alta', 'imprescindible'];

/** "★★★★½" para 4,5 */
export function stars(rating: number | null) {
  if (!rating) return '';
  const full = Math.floor(rating);
  return '★'.repeat(full) + (rating - full >= 0.5 ? '½' : '');
}

/** Una etiqueta de Obsidian no admite espacios ni la mayoría de los signos */
export const toTag = (t: string) =>
  `#${t
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_/-]/gu, '')}`;

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

function markers(b: Book) {
  const tags = [
    STATUS_TAGS[b.status],
    PRIORITY_TAGS[b.priority],
    ...b.tags.map((t) => toTag(t).slice(1)),
  ].filter((t): t is string => !!t && t.length > 0);
  return [b.note ? oneLine(b.note) : '', stars(b.rating), ...tags.map((t) => `#${t}`)]
    .filter(Boolean)
    .join(' ');
}

const check = (b: Book) => (b.status === 'read' ? '[x]' : '[ ]');
const withYear = (b: Book) => (b.year ? `${b.title} (${b.year})` : b.title);

export function exportMarkdown(books: Book[], date = new Date()): string {
  const live = books.filter((b) => !b.deleted_at);
  const out = [
    '---',
    EXPORT_MARK,
    'version: 1',
    `exportado: ${date.toISOString().slice(0, 10)}`,
    `libros: ${live.length}`,
    '---',
    '',
    '> Exportado desde Bookloft. `[x]` leído · `#leyendo` · `#deseo` · `#sin-terminar` · sin marca: por leer.',
    '',
  ];
  const unknown = 'Sin autor';
  for (const group of groupByAuthorAndSeries(live, unknown)) {
    out.push(`# ${group.author}`, '');
    for (const s of group.series) {
      out.push(`## ${s.name ?? 'Sin saga'}`);
      for (const b of s.books) {
        const m = markers(b);
        if (s.name) {
          // El número va primero; sin número, 0 (queda al principio de la saga)
          out.push(`- ${check(b)} ${b.series_index ?? 0}. ${withYear(b)}${m ? ` — ${m}` : ''}`);
        } else {
          const author = b.authors[0] ?? '?';
          out.push(`- ${check(b)} **${withYear(b)}** — ${author}${m ? ` · ${m}` : ''}`);
        }
      }
      out.push('');
    }
  }
  return out.join('\n');
}
