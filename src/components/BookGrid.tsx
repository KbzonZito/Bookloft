// Cuadrícula de portadas. Cada portada lleva un layoutId para volar a la ficha y volver.
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState, type PointerEvent } from 'react';
import { haptic } from '../app/native';
import { useReading } from '../app/reading';
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

/**
 * Tocar y mantener presionado, con eventos de puntero propios:
 * - Toque: soltar antes de 450 ms sin moverse más de 8 px. Abre al soltar, sin esperar el "click"
 *   del navegador: justo después de un gesto rápido (cerrar la ficha arrastrándola) Chrome en
 *   Android a veces descarta ese click, y el libro no se abría.
 * - Mantener: 450 ms quieto.
 * El click que llega después (si llega) se ignora; el teclado sigue usando el click normal.
 */
function usePress(onTap: () => void, onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const handledAt = useRef(0);
  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        handledAt.current = Date.now();
        start.current = null;
        haptic.tap();
        onLongPress();
      }, 450);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancel();
    },
    onPointerUp: () => {
      const wasTap = start.current !== null;
      cancel();
      if (!wasTap) return;
      handledAt.current = Date.now();
      onTap();
    },
    cancel,
    /** Ya se atendió con los eventos de puntero: el click que sigue sobra */
    handled: () => Date.now() - handledAt.current < 800,
  };
}

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
  const { quickActions } = useReading();
  const press = usePress(
    () => onOpen(book),
    () => quickActions(book),
  );
  return (
    <button
      className="book-cell"
      onPointerDown={(e) => {
        if (flight === 'still') onPrepare(book);
        press.onPointerDown(e);
      }}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (press.handled()) return;
        onOpen(book);
      }}
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
