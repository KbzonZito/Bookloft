// Libros encontrados (Open Library, IA, ISBN) que se pueden agregar con un toque
import { Check, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useLibrary } from '../app/library';
import { haptic } from '../app/native';
import type { Book, Candidate, Status } from '../data';
import { normalize } from '../data/text';
import { useI18n } from '../i18n';
import { spring } from '../ui/motion';
import { ensureCover } from '../sources/covers';
import { Cover } from './Cover';

const keyOf = (c: Candidate) =>
  c.ol_key ?? `${normalize(c.title)}|${normalize(c.authors[0] ?? '')}`;

/** ¿Ya está en la biblioteca? Por Open Library, ISBN o título y autor */
export function inLibrary(books: Book[], c: Candidate) {
  const title = normalize(c.title);
  const author = normalize(c.authors[0] ?? '');
  return books.some(
    (b) =>
      (c.ol_key && b.ol_key === c.ol_key) ||
      (c.isbn && b.isbn === c.isbn) ||
      (normalize(b.title) === title && normalize(b.authors[0] ?? '') === author),
  );
}

// La Cover espera un Book; un candidato todavía no lo es
const asBook = (c: Candidate) =>
  ({ id: keyOf(c), title: c.title, authors: c.authors, cover_url: c.cover_url }) as Book;

export function Candidates({
  candidates,
  books,
  status,
  sourceUrl,
  onAdded,
}: {
  candidates: Candidate[];
  books: Book[];
  status: Status;
  sourceUrl?: string | null;
  onAdded?: (book: Book) => void;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function add(c: Candidate) {
    haptic.tap();
    const { book, duplicate } = await lib.addBook(c, { status, source_url: sourceUrl ?? null });
    if (!duplicate) void ensureCover(lib, book);
    setAdded((s) => new Set(s).add(keyOf(c)));
    onAdded?.(book);
  }

  return (
    <ul className="candidates">
      <AnimatePresence initial={false}>
        {candidates.map((c, i) => {
          const key = keyOf(c);
          const done = added.has(key) || inLibrary(books, c);
          return (
            <motion.li
              key={key}
              className="candidate"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ ...spring.sheet, delay: Math.min(i, 8) * 0.025 }}
            >
              <div className="candidate-cover">
                <Cover book={asBook(c)} />
              </div>
              <div className="candidate-text">
                <span className="candidate-title">{c.title}</span>
                <span className="candidate-meta">
                  {[c.authors[0], c.year].filter(Boolean).join(', ')}
                </span>
              </div>
              <button
                className={`candidate-add ${done ? 'done' : ''}`}
                disabled={done}
                aria-label={done ? t('add.inLibrary') : t('add.addThis', { title: c.title })}
                onClick={() => void add(c)}
              >
                {done ? <Check size={18} strokeWidth={2} /> : <Plus size={20} strokeWidth={2} />}
              </button>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
