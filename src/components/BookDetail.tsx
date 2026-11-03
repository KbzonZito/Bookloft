// Ficha del libro. La portada llega volando desde la cuadrícula (mismo layoutId) y la página
// toma un tinte del color de esa portada.
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLibrary } from '../app/library';
import { SHELVES } from '../app/shelves';
import { STATUSES, type Book, type BookPatch } from '../data';
import { useI18n } from '../i18n';
import { fade, spring } from '../ui/motion';
import { Rating, Segmented } from './Controls';
import { Cover, useCoverColor } from './Cover';
import { Sheet } from './Sheet';

function useTint(book: Book): CSSProperties {
  const color = useCoverColor(book);
  return color ? ({ '--tint': color } as CSSProperties) : {};
}

function Head({ book }: { book: Book }) {
  const { t } = useI18n();
  return (
    <div className="detail-head">
      <motion.div className="detail-cover" layoutId={`cover-${book.id}`} transition={spring.cover}>
        <Cover book={book} size="L" eager />
      </motion.div>
      <motion.div
        className="detail-titles"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: fade }}
        transition={{ ...spring.sheet, delay: 0.06 }}
      >
        <h1 className="detail-title">{book.title}</h1>
        {book.authors.length > 0 && <p className="detail-authors">{book.authors.join(', ')}</p>}
        {book.series && (
          <p className="detail-series">
            {book.series_index != null
              ? t('book.series', { n: book.series_index, series: book.series })
              : t('book.seriesNoIndex', { series: book.series })}
          </p>
        )}
      </motion.div>
    </div>
  );
}

function Body({ book, onDelete }: { book: Book; onDelete: (b: Book) => void }) {
  const lib = useLibrary();
  const { t, status, date } = useI18n();
  const update = (patch: BookPatch) => void lib.updateBook(book.id, patch);

  // La nota se guarda al dejar de escribir, no en cada tecla
  const [note, setNote] = useState(book.note ?? '');
  const saved = useRef(book.note ?? '');
  useEffect(() => {
    if (note === saved.current) return;
    const id = setTimeout(() => {
      saved.current = note;
      update({ note: note.trim() ? note : null });
    }, 600);
    return () => clearTimeout(id);
  }, [note]);
  useEffect(() => setNote(book.note ?? ''), [book.id]);

  const [tag, setTag] = useState('');
  const addTag = () => {
    const value = tag.trim();
    if (value && !book.tags.includes(value)) update({ tags: [...book.tags, value] });
    setTag('');
  };

  const facts: [string, string][] = [[t('book.added'), date(book.added_at)]];
  if (book.started_at) facts.push([t('book.started'), date(book.started_at)]);
  if (book.finished_at) facts.push([t('book.finished'), date(book.finished_at)]);
  if (book.pages) facts.push(['', t('book.pages', { n: book.pages })]);

  return (
    <motion.div
      className="detail-body"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: fade }}
      transition={{ ...spring.sheet, delay: 0.1 }}
    >
      <section>
        <h2 className="detail-label">{t('book.status')}</h2>
        <Segmented
          wrap
          label={t('book.status')}
          value={book.status}
          options={SHELVES.filter((s) => STATUSES.includes(s)).map((s) => ({
            value: s,
            label: status(s),
          }))}
          onChange={(s) => update({ status: s })}
        />
      </section>

      <section className="detail-row">
        <div>
          <h2 className="detail-label">{t('book.rating')}</h2>
          <Rating value={book.rating} onChange={(rating) => update({ rating })} />
        </div>
      </section>

      <section>
        <h2 className="detail-label">{t('book.priority')}</h2>
        <Segmented
          label={t('book.priority')}
          value={book.priority}
          options={[0, 1, 2].map((p) => ({ value: p, label: t(`priority.${p}` as 'priority.0') }))}
          onChange={(priority) => update({ priority })}
        />
      </section>

      <section>
        <h2 className="detail-label">{t('book.tags')}</h2>
        <div className="tags">
          {book.tags.map((tg) => (
            <button
              key={tg}
              className="tag"
              aria-label={t('book.removeTag', { tag: tg })}
              onClick={() => update({ tags: book.tags.filter((x) => x !== tg) })}
            >
              {tg}
              <X size={14} strokeWidth={1.75} aria-hidden />
            </button>
          ))}
          <input
            className="tag-input"
            value={tag}
            placeholder={t('book.addTag')}
            aria-label={t('book.addTag')}
            enterKeyHint="done"
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            onBlur={addTag}
          />
        </div>
      </section>

      <section>
        <h2 className="detail-label">
          <label htmlFor={`note-${book.id}`}>{t('book.note')}</label>
        </h2>
        <textarea
          id={`note-${book.id}`}
          className="field note"
          rows={3}
          value={note}
          placeholder={t('book.notePlaceholder')}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== saved.current) {
              saved.current = note;
              update({ note: note.trim() ? note : null });
            }
          }}
        />
      </section>

      <dl className="facts">
        {facts.map(([k, v]) => (
          <div key={k + v}>
            {k && <dt>{k}</dt>}
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <button className="button danger" onClick={() => onDelete(book)}>
        {t('book.delete')}
      </button>
    </motion.div>
  );
}

/** En teléfono y tablet vertical: hoja a pantalla completa que se cierra arrastrando la portada */
export function BookSheet({
  book,
  onClose,
  onDelete,
}: {
  book: Book;
  onClose: () => void;
  onDelete: (b: Book) => void;
}) {
  return (
    <Sheet
      label={book.title}
      onClose={onClose}
      className="detail-sheet"
      variant="stage"
      style={useTint(book)}
      header={<Head book={book} />}
    >
      <Body book={book} onDelete={onDelete} />
    </Sheet>
  );
}

/** En tablet horizontal y escritorio: panel a la derecha de la cuadrícula */
export function BookPanel({
  book,
  onClose,
  onDelete,
}: {
  book: Book;
  onClose: () => void;
  onDelete: (b: Book) => void;
}) {
  const { t } = useI18n();
  return (
    <motion.aside
      className="detail-panel"
      style={useTint(book)}
      aria-label={book.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fade}
    >
      <button className="icon-button panel-close" onClick={onClose} aria-label={t('book.close')}>
        <X size={20} strokeWidth={1.5} />
      </button>
      <Head book={book} />
      <Body book={book} onDelete={onDelete} />
    </motion.aside>
  );
}
