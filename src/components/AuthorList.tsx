// Vista por autor y saga, como en las notas de Obsidian: Autor > Saga > libros en orden
import { memo, useEffect, useMemo, useRef } from 'react';
import type { Book } from '../data';
import { groupByAuthorAndSeries } from '../app/shelves';
import { useI18n } from '../i18n';
import { BookCell, flightFor } from './BookGrid';

export const AuthorList = memo(function AuthorList({
  books,
  activeId,
  openId,
  onPrepare,
  onOpen,
}: {
  books: Book[];
  activeId: string | null;
  openId: string | null;
  onPrepare: (b: Book) => void;
  onOpen: (b: Book) => void;
}) {
  const { t } = useI18n();
  const groups = useMemo(() => groupByAuthorAndSeries(books, '—'), [books]);
  const list = useRef<HTMLDivElement>(null);

  // Las tiras de una saga se desplazan solas: el gesto no debe llegar al deslizar entre estantes
  // (Motion escucha pointerdown nativo en la página, antes de que React lo vea)
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const stop = (e: PointerEvent) => {
      if ((e.target as Element).closest('.series-strip')) e.stopPropagation();
    };
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, []);

  return (
    <div className="author-list" ref={list}>
      {groups.map((g) => (
        <section key={g.author} className="author-group">
          <h2 className="author-name">
            {g.author}
            <span className="author-count">
              {g.count === 1 ? t('app.book') : t('app.books', { n: g.count })}
            </span>
          </h2>
          {g.series.map((s) => (
            <div key={s.name ?? ''} className="series-row">
              {s.name ? (
                <h3 className="series-name">{s.name}</h3>
              ) : (
                g.series.length > 1 && <h3 className="series-name">{t('author.standalone')}</h3>
              )}
              <div className="series-strip">
                {s.books.map((b) => (
                  <BookCell
                    key={b.id}
                    book={b}
                    flight={flightFor(b.id, activeId, openId)}
                    showStatus={false}
                    onPrepare={onPrepare}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
});
