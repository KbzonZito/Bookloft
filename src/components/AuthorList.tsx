// Vista por autor y saga, como en las notas de Obsidian: Autor > Saga > libros en orden
import { memo, useEffect, useMemo, useRef } from 'react';
import type { Book } from '../data';
import { progressFor, type SeriesProgress } from '../app/reading';
import { groupByAuthorAndSeries } from '../app/shelves';
import { useI18n } from '../i18n';
import { BookCell, flightFor } from './BookGrid';

export const AuthorList = memo(function AuthorList({
  books,
  activeId,
  openId,
  onPrepare,
  onOpen,
  progress,
}: {
  books: Book[];
  /** Progreso de cada saga, calculado con toda la biblioteca (no solo este estante) */
  progress: Map<string, SeriesProgress>;
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
          {g.series.map((s) => {
            const p = s.name ? progressFor(progress, s.books[0]) : undefined;
            return (
              <div key={s.name ?? ''} className="series-row">
                {s.name ? (
                  <h3 className="series-name">
                    <span>{s.name}</span>
                    {p && p.total > 1 && <SeriesMeter progress={p} />}
                  </h3>
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
                      tag={p?.next?.id === b.id ? t('series.nextTag') : undefined}
                      onPrepare={onPrepare}
                      onOpen={onOpen}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
});

/** "2 de 5" con una barrita: leídos (lleno) y leyendo (a medias) */
export function SeriesMeter({ progress: p }: { progress: SeriesProgress }) {
  const { t } = useI18n();
  const done = p.read === p.total;
  return (
    <span
      className={`series-meter ${done ? 'done' : ''}`}
      aria-label={t('series.progress', { read: p.read, total: p.total })}
    >
      <span className="meter" aria-hidden>
        <span style={{ width: `${(p.read / p.total) * 100}%` }} />
        <span className="reading" style={{ width: `${(p.reading / p.total) * 100}%` }} />
      </span>
      <span aria-hidden>{done ? t('series.complete') : `${p.read}/${p.total}`}</span>
    </span>
  );
}
