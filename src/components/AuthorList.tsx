// Vista por autor y saga, como en las notas de Obsidian: Autor > Saga > libros en orden
import { memo, useMemo } from 'react';
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
  return (
    <div className="author-list">
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
              {s.name && <h3 className="series-name">{s.name}</h3>}
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
