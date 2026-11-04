// Cuadrícula de portadas. Cada portada lleva un layoutId para volar a la ficha y volver.
import { motion } from 'motion/react';
import { memo, useEffect, useState } from 'react';
import type { Book } from '../data';
import { useI18n } from '../i18n';
import { spring } from '../ui/motion';
import { Cover } from './Cover';

// Primero se pintan las que caben en pantalla; el resto en el cuadro siguiente,
// así cambiar de estante con 500 libros no traba la animación
const FIRST_BATCH = 30;

function useProgressive(count: number) {
  const [limit, setLimit] = useState(FIRST_BATCH);
  useEffect(() => {
    setLimit(FIRST_BATCH);
    if (count <= FIRST_BATCH) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setLimit(Number.POSITIVE_INFINITY)),
    );
    return () => cancelAnimationFrame(id);
  }, [count]);
  return limit;
}

/**
 * Cómo participa la portada en el vuelo hacia la ficha:
 * - still: portada normal, sin layoutId (Motion mide cada layoutId en cada animación;
 *   con 500 portadas eso traba el primer cuadro)
 * - shared: la última abierta, con layoutId para volar a la ficha y volver
 * - away: está en la ficha; aquí queda solo el hueco
 */
export type CoverFlight = 'still' | 'shared' | 'away';

export const flightFor = (
  id: string,
  activeId: string | null,
  openId: string | null,
): CoverFlight => (id === openId ? 'away' : id === activeId ? 'shared' : 'still');

export const BookCell = memo(function BookCell({
  book,
  flight,
  showStatus,
  tag,
  onPrepare,
  onOpen,
}: {
  book: Book;
  flight: CoverFlight;
  showStatus: boolean;
  /** Etiqueta chica sobre la portada (por ejemplo, "Sigue" en una saga) */
  tag?: string;
  onPrepare: (b: Book) => void;
  onOpen: (b: Book) => void;
}) {
  const { status } = useI18n();
  const series =
    book.series && book.series_index != null ? `${book.series} ${book.series_index}` : null;
  return (
    <button
      className="book-cell"
      onPointerDown={() => flight === 'still' && onPrepare(book)}
      onClick={() => onOpen(book)}
    >
      <div className="cover-wrap">
        {flight === 'away' ? (
          <div className="cover cover-slot" />
        ) : flight === 'shared' ? (
          <motion.div layoutId={`cover-${book.id}`} transition={spring.cover} style={{ zIndex: 1 }}>
            <Cover book={book} />
          </motion.div>
        ) : (
          <Cover book={book} />
        )}
        {tag && <span className="cover-tag">{tag}</span>}
        {book.priority > 0 && (
          <span className="priority-mark" aria-hidden>
            {book.priority === 2 ? '••' : '•'}
          </span>
        )}
      </div>
      <span className="book-title">{book.title}</span>
      <span className="book-meta">
        {showStatus ? status(book.status) : (series ?? book.authors[0] ?? '')}
      </span>
    </button>
  );
});

export function BookGrid({
  books,
  activeId,
  openId,
  showStatus = false,
  onPrepare,
  onOpen,
}: {
  books: Book[];
  activeId: string | null;
  openId: string | null;
  showStatus?: boolean;
  onPrepare: (b: Book) => void;
  onOpen: (b: Book) => void;
}) {
  const limit = useProgressive(books.length);
  return (
    <div className="book-grid">
      {books.slice(0, limit).map((b) => (
        <BookCell
          key={b.id}
          book={b}
          flight={flightFor(b.id, activeId, openId)}
          showStatus={showStatus}
          onPrepare={onPrepare}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
