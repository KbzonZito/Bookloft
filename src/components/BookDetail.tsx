// Ficha del libro. La portada llega volando desde la cuadrícula (mismo layoutId) y la página
// toma un tinte del color de esa portada.
import { Check, ImageUp, ListPlus, Paperclip, PenLine, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLibrary } from '../app/library';
import { STATUS_ORDER } from '../app/shelves';
import { type Book, type BookPatch } from '../data';
import { useI18n } from '../i18n';
import { fade, spring } from '../ui/motion';
import { Rating, Segmented } from './Controls';
import { progressFor, useReading } from '../app/reading';
import { ensureDetails } from '../sources/details';
import { SeriesMeter } from './AuthorList';
import { CoverPicker, EditBook } from './BookEdit';
import { Cover, useCoverColor } from './Cover';
import { Sheet } from './Sheet';
import { ACCEPT, FileRow, useFiles, useImport } from './Vault';

type Toast = (m: string, action?: { label: string; run: () => void }) => void;

/** Los EPUB y PDF de este libro, con un botón para adjuntar más */
function BookFiles({ book, toast }: { book: Book; toast: Toast }) {
  const { t } = useI18n();
  const files = useFiles(book.id);
  const input = useRef<HTMLInputElement>(null);
  const { busy, importFiles } = useImport(toast);
  return (
    <section>
      <h2 className="detail-label">{t('book.files')}</h2>
      <div className="book-files">
        {files?.map((f) => (
          <FileRow key={f.id} file={f} books={[]} toast={toast} compact />
        ))}
        <button className="button attach" disabled={!!busy} onClick={() => input.current?.click()}>
          <Paperclip size={16} strokeWidth={1.5} aria-hidden />
          {busy ?? t('book.attach')}
        </button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = '';
            if (list.length) void importFiles(list, { bookId: book.id });
          }}
        />
      </div>
    </section>
  );
}

function useTint(book: Book): CSSProperties {
  const color = useCoverColor(book);
  return color ? ({ '--tint': color } as CSSProperties) : {};
}

function Head({ book }: { book: Book }) {
  const { t } = useI18n();
  const { progress: all, openBook } = useReading();
  const progress = progressFor(all, book);
  return (
    <div className="detail-head">
      {/* Si el libro ya no está en la pantalla de atrás (cambió de estante), la portada no tiene a
          dónde volar: se desvanece en vez de quedarse quieta hasta que se cierra la hoja */}
      <motion.div
        className="detail-cover"
        layoutId={`cover-${book.id}`}
        transition={spring.cover}
        exit={{ opacity: 0, scale: 0.94, transition: fade }}
      >
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
        {progress && progress.total > 1 && (
          <div className="detail-progress">
            <SeriesMeter progress={progress} />
            {progress.next && progress.next.id !== book.id && (
              <button className="link-button" onClick={() => openBook(progress.next!)}>
                {t('series.next', { title: progress.next.title })}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

type DetailTab = 'notes' | 'info';

/** Mediodía UTC: la fecha elegida no cambia de día por la zona horaria */
const toIso = (day: string) => (day ? `${day}T12:00:00.000Z` : null);

function Body({
  book,
  onDelete,
  toast,
}: {
  book: Book;
  onDelete: (b: Book) => void;
  toast: Toast;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [tab, setTab] = useState<DetailTab>('notes');
  useEffect(() => setTab('notes'), [book.id]);

  // La reseña, las páginas y los datos de Open Library se buscan la primera vez que se abre
  useEffect(() => void ensureDetails(lib, book), [book.id]);

  return (
    <motion.div
      className="detail-body"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: fade }}
      transition={{ ...spring.sheet, delay: 0.1 }}
    >
      <div className="detail-tabs" role="tablist">
        {(['notes', 'info'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {t(`detail.${id}`)}
            {tab === id && (
              <motion.span
                className="detail-tab-line"
                layoutId="detail-tab-line"
                transition={spring.snappy}
              />
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className="detail-tab"
          role="tabpanel"
          initial={{ opacity: 0, x: tab === 'info' ? 12 : -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={spring.sheet}
        >
          {tab === 'notes' ? (
            <MyNotes book={book} onDelete={onDelete} toast={toast} />
          ) : (
            <BookInfoTab book={book} />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/** Lo que escribo yo: estado, Próximos, nota, progreso, fechas, prioridad, etiquetas, archivos */
function MyNotes({
  book,
  onDelete,
  toast,
}: {
  book: Book;
  onDelete: (b: Book) => void;
  toast: Toast;
}) {
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

  const [editing, setEditing] = useState<'cover' | 'data' | null>(null);

  const [tag, setTag] = useState('');
  const addTag = () => {
    const value = tag.trim();
    if (value && !book.tags.includes(value)) update({ tags: [...book.tags, value] });
    setTag('');
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <section>
        <h2 className="detail-label">{t('book.status')}</h2>
        <Segmented
          wrap
          label={t('book.status')}
          value={book.status}
          options={STATUS_ORDER.map((s) => ({ value: s, label: status(s) }))}
          onChange={(s) => update({ status: s })}
        />
        {book.status !== 'reading' && (
          <button
            className={`button quiet up-next-toggle ${book.up_next != null ? 'on' : ''}`}
            onClick={async () => {
              const on = book.up_next == null;
              await lib.setUpNext(book.id, on);
              if (on) toast(t('upnext.added', { title: book.title }));
            }}
          >
            {book.up_next != null ? (
              <Check size={16} strokeWidth={2} aria-hidden />
            ) : (
              <ListPlus size={16} strokeWidth={1.6} aria-hidden />
            )}
            {book.up_next != null ? t('upnext.inList') : t('upnext.add')}
          </button>
        )}
      </section>

      <section className="detail-row">
        <div>
          <h2 className="detail-label">{t('book.rating')}</h2>
          <Rating value={book.rating} onChange={(rating) => update({ rating })} />
        </div>
      </section>

      {(book.status === 'reading' || book.current_page != null) && (
        <PagesRead book={book} onChange={update} />
      )}

      <section className="detail-dates">
        <label className="field-label">
          {t('book.started')}
          <input
            className="field"
            type="date"
            max={today}
            value={book.started_at?.slice(0, 10) ?? ''}
            onChange={(e) => update({ started_at: toIso(e.target.value) })}
          />
        </label>
        <label className="field-label">
          {t('book.finished')}
          <input
            className="field"
            type="date"
            max={today}
            value={book.finished_at?.slice(0, 10) ?? ''}
            onChange={(e) => update({ finished_at: toIso(e.target.value) })}
          />
        </label>
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

      <BookFiles book={book} toast={toast} />

      <section className="detail-edit">
        <button className="button quiet" onClick={() => setEditing('cover')}>
          <ImageUp size={16} strokeWidth={1.5} aria-hidden />
          {t('cover.change')}
        </button>
        <button className="button quiet" onClick={() => setEditing('data')}>
          <PenLine size={16} strokeWidth={1.5} aria-hidden />
          {t('edit.title')}
        </button>
      </section>
      {createPortal(
        <AnimatePresence>
          {editing === 'cover' && (
            <CoverPicker key="cover" book={book} onClose={() => setEditing(null)} />
          )}
          {editing === 'data' && (
            <EditBook key="data" book={book} toast={toast} onClose={() => setEditing(null)} />
          )}
        </AnimatePresence>,
        document.body,
      )}

      <p className="hint">{t('book.addedOn', { date: date(book.added_at) })}</p>

      <button className="button danger" onClick={() => onDelete(book)}>
        {t('book.delete')}
      </button>
    </>
  );
}

/** Páginas leídas: una barra y el número; si no se sabe el total, se puede escribir */
function PagesRead({ book, onChange }: { book: Book; onChange: (p: BookPatch) => void }) {
  const { t } = useI18n();
  const [page, setPage] = useState(book.current_page ?? 0);
  useEffect(() => setPage(book.current_page ?? 0), [book.id, book.current_page]);
  const total = book.pages ?? 0;
  const commit = (n: number) => {
    const value = Math.max(0, Math.min(total || 99999, Math.round(n)));
    setPage(value);
    if (value !== book.current_page) onChange({ current_page: value });
  };
  return (
    <section>
      <h2 className="detail-label">{t('book.pagesRead')}</h2>
      <div className="pages-read">
        {total > 0 && (
          <input
            type="range"
            min={0}
            max={total}
            value={page}
            aria-label={t('book.pagesRead')}
            style={{ '--fill': `${(page / total) * 100}%` } as CSSProperties}
            onChange={(e) => setPage(Number(e.target.value))}
            onPointerUp={() => commit(page)}
            onKeyUp={() => commit(page)}
          />
        )}
        <span className="pages-read-numbers">
          <input
            className="field pages-input"
            inputMode="numeric"
            value={page || ''}
            placeholder="0"
            aria-label={t('book.currentPage')}
            onChange={(e) => setPage(Number(e.target.value.replace(/\D/g, '')) || 0)}
            onBlur={() => commit(page)}
          />
          <span>/</span>
          {total > 0 ? (
            <span>{total}</span>
          ) : (
            <input
              className="field pages-input"
              inputMode="numeric"
              placeholder="?"
              aria-label={t('book.totalPages')}
              onBlur={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                if (n > 0) onChange({ pages: n });
              }}
            />
          )}
        </span>
      </div>
      {total > 0 && page > 0 && (
        <p className="hint">{t('book.percent', { n: Math.round((page / total) * 100) })}</p>
      )}
    </section>
  );
}

const LANG2: Record<string, string> = {
  eng: 'en',
  spa: 'es',
  fre: 'fr',
  ger: 'de',
  ita: 'it',
  por: 'pt',
  chi: 'zh',
  jpn: 'ja',
  rus: 'ru',
  dut: 'nl',
  pol: 'pl',
  swe: 'sv',
  dan: 'da',
  nor: 'no',
  fin: 'fi',
  kor: 'ko',
  cat: 'ca',
  gre: 'el',
  tur: 'tr',
  ara: 'ar',
  heb: 'he',
  hun: 'hu',
  cze: 'cs',
  rum: 'ro',
};

/** Lo que viene de Open Library y Apple Books, separado de lo que escribo yo */
function BookInfoTab({ book }: { book: Book }) {
  const { t, lang } = useI18n();
  const info = book.info;
  const languageName = (code: string) => {
    try {
      return new Intl.DisplayNames([lang], { type: 'language' }).of(LANG2[code] ?? code) ?? code;
    } catch {
      return code;
    }
  };
  const nf = (n: number, digits = 0) =>
    new Intl.NumberFormat(lang, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n);

  const facts: [string, string][] = [];
  if (info?.first_publish_year ?? book.year)
    facts.push([t('info.firstPublished'), String(info?.first_publish_year ?? book.year)]);
  if (book.pages) facts.push([t('info.pages'), nf(book.pages)]);
  if (info?.editions) facts.push([t('info.editions'), nf(info.editions)]);
  if (info?.publishers?.length)
    facts.push([t('info.publisher'), info.publishers.slice(0, 2).join(' · ')]);
  if (info?.languages?.length) {
    const names = info.languages.slice(0, 4).map(languageName);
    const more = info.languages.length - names.length;
    facts.push([t('info.languages'), names.join(', ') + (more > 0 ? ` +${more}` : '')]);
  }
  if (book.isbn) facts.push(['ISBN', book.isbn]);

  const loading = !info && book.description === null && navigator.onLine;

  return (
    <>
      {info?.ratings_average && (
        <section className="info-rating">
          <span className="info-stars" aria-hidden>
            ★
          </span>
          <span className="info-score">{nf(info.ratings_average, 2)}</span>
          {info.ratings_count && (
            <span className="info-votes">{t('info.votes', { n: nf(info.ratings_count) })}</span>
          )}
        </section>
      )}

      {info?.subjects && info.subjects.length > 0 && (
        <section>
          <div className="tags">
            {info.subjects.map((s) => (
              <span key={s} className="tag static">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {book.description ? (
        <Description text={book.description} />
      ) : (
        loading && <p className="hint pulse">{t('info.loading')}</p>
      )}

      {facts.length > 0 && (
        <dl className="info-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {!loading && !info?.ratings_average && !book.description && facts.length === 0 && (
        <p className="hint">{t('info.none')}</p>
      )}
      <p className="hint info-source">{t('info.source')}</p>
    </>
  );
}

/** La reseña, cortada en unas líneas; se despliega entera al tocarla */
function Description({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
      <h2 className="detail-label">{t('book.description')}</h2>
      <p className={`description ${long && !open ? 'clamped' : ''}`}>{text}</p>
      {long && (
        <button className="link-button" onClick={() => setOpen(!open)}>
          {open ? t('book.less') : t('book.more')}
        </button>
      )}
    </motion.section>
  );
}

/** En teléfono y tablet vertical: hoja a pantalla completa que se cierra arrastrando la portada */
export function BookSheet({
  book,
  onClose,
  onDelete,
  toast,
}: {
  book: Book;
  onClose: () => void;
  onDelete: (b: Book) => void;
  toast: Toast;
}) {
  const { t } = useI18n();
  return (
    <Sheet
      label={book.title}
      onClose={onClose}
      className="detail-sheet"
      variant="stage"
      style={useTint(book)}
      header={<Head book={book} />}
      closeLabel={t('book.close')}
    >
      <Body book={book} onDelete={onDelete} toast={toast} />
    </Sheet>
  );
}

/** En tablet horizontal y escritorio: panel a la derecha de la cuadrícula */
export function BookPanel({
  book,
  onClose,
  onDelete,
  toast,
}: {
  book: Book;
  onClose: () => void;
  onDelete: (b: Book) => void;
  toast: Toast;
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
      <Body book={book} onDelete={onDelete} toast={toast} />
    </motion.aside>
  );
}
