// Resumen del año: lo leído, páginas, meses, autores, los mejor calificados y sagas terminadas.
// Se puede compartir como imagen (formato historia, 1080×1920).
import { Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { undatedReads, yearStats, yearsWithReading } from '../app/year';
import type { Book } from '../data';
import { useI18n } from '../i18n';
import { shareFile } from '../sources/share-file';
import { spring } from '../ui/motion';
import { Segmented } from './Controls';
import { Cover } from './Cover';
import { Sheet } from './Sheet';
import { renderYearImage } from './year-image';

export function YearReview({
  books,
  onClose,
  onOpenBook,
  toast,
}: {
  books: Book[];
  onClose: () => void;
  onOpenBook: (b: Book) => void;
  toast: (m: string) => void;
}) {
  const { t, lang } = useI18n();
  const years = useMemo(() => yearsWithReading(books), [books]);
  const [year, setYear] = useState(years[0]);
  const s = useMemo(() => yearStats(books, year), [books, year]);
  const undated = undatedReads(books);
  const [sharing, setSharing] = useState(false);
  const month = (i: number) =>
    new Intl.DateTimeFormat(lang, { month: 'narrow' }).format(new Date(2026, i, 1));
  const fmt = (n: number) => new Intl.NumberFormat(lang).format(n);
  const max = Math.max(1, ...s.byMonth);

  const open = (b: Book) => {
    onClose();
    onOpenBook(b);
  };

  async function share() {
    setSharing(true);
    try {
      const blob = await renderYearImage(s, t, lang);
      await shareFile(`Mi ${year} en libros.png`, blob);
    } catch (error) {
      console.error(error);
      toast(t('share.failed'));
    } finally {
      setSharing(false);
    }
  }

  return (
    <Sheet label={t('year.title', { year })} onClose={onClose} className="form-sheet year-sheet">
      <div className="year-review">
        <h1 className="sheet-title">{t('year.title', { year })}</h1>
        {years.length > 1 && (
          <Segmented
            label={t('year.pick')}
            value={year}
            options={years.slice(0, 4).map((y) => ({ value: y, label: String(y) }))}
            onChange={setYear}
          />
        )}

        <motion.div
          key={year}
          className="year-body"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.sheet}
        >
          <div className="year-hero">
            <span className="year-big">{s.books.length}</span>
            <span className="year-big-label">
              {s.books.length === 1 ? t('year.book') : t('year.books')}
            </span>
          </div>

          {s.books.length > 0 ? (
            <>
              <dl className="year-facts">
                {s.withPages > 0 && (
                  <div>
                    <dt>{t('year.pages')}</dt>
                    <dd>{fmt(s.pages)}</dd>
                  </div>
                )}
                {s.avgRating && (
                  <div>
                    <dt>{t('year.avg')}</dt>
                    <dd>
                      ★{' '}
                      {new Intl.NumberFormat(lang, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }).format(s.avgRating)}
                    </dd>
                  </div>
                )}
                {s.seriesCompleted.length > 0 && (
                  <div>
                    <dt>{t('year.seriesDone')}</dt>
                    <dd>{s.seriesCompleted.length}</dd>
                  </div>
                )}
              </dl>

              <section>
                <h2 className="detail-label">{t('year.months')}</h2>
                <div className="year-months" aria-hidden>
                  {s.byMonth.map((n, i) => (
                    <div key={i} className="year-month">
                      <motion.span
                        className={n ? '' : 'empty'}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ ...spring.sheet, delay: i * 0.025 }}
                        style={{ height: `${Math.max(6, (n / max) * 100)}%` }}
                      />
                      <small>{month(i)}</small>
                    </div>
                  ))}
                </div>
              </section>

              {s.topRated.length > 0 && (
                <BookRow title={t('year.best')} books={s.topRated} onOpen={open} />
              )}

              {s.topAuthors.length > 0 && (
                <section>
                  <h2 className="detail-label">{t('year.authors')}</h2>
                  <ol className="year-authors">
                    {s.topAuthors.map((a) => (
                      <li key={a.author}>
                        <span>{a.author}</span>
                        <span className="year-count">
                          {a.count === 1 ? t('app.book') : t('app.books', { n: a.count })}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {(s.longest || s.shortest) && (
                <dl className="year-facts small">
                  {s.longest && (
                    <div>
                      <dt>{t('year.longest')}</dt>
                      <dd>
                        <button className="link-button" onClick={() => open(s.longest!)}>
                          {s.longest.title}
                        </button>{' '}
                        · {t('book.pages', { n: s.longest.pages! })}
                      </dd>
                    </div>
                  )}
                  {s.shortest && (
                    <div>
                      <dt>{t('year.shortest')}</dt>
                      <dd>
                        <button className="link-button" onClick={() => open(s.shortest!)}>
                          {s.shortest.title}
                        </button>{' '}
                        · {t('book.pages', { n: s.shortest.pages! })}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {s.seriesCompleted.length > 0 && (
                <p className="hint">
                  {t('year.seriesList', { list: s.seriesCompleted.join(', ') })}
                </p>
              )}

              <BookRow title={t('year.all')} books={s.books} onOpen={open} />

              <button className="button primary" disabled={sharing} onClick={() => void share()}>
                <Share2 size={18} strokeWidth={1.6} aria-hidden />
                {sharing ? t('year.sharing') : t('year.share')}
              </button>
            </>
          ) : (
            <p className="hint">{t('year.empty')}</p>
          )}

          {undated > 0 && <p className="hint">{t('year.undated', { n: undated })}</p>}
        </motion.div>
      </div>
    </Sheet>
  );
}

function BookRow({
  title,
  books,
  onOpen,
}: {
  title: string;
  books: Book[];
  onOpen: (b: Book) => void;
}) {
  return (
    <section>
      <h2 className="detail-label">{title}</h2>
      <div className="year-covers">
        {books.map((b) => (
          <button key={b.id} className="year-cover" onClick={() => onOpen(b)} aria-label={b.title}>
            <Cover book={b} />
          </button>
        ))}
      </div>
    </section>
  );
}
