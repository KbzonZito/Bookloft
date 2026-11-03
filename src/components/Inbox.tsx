// La bandeja: cada cosa compartida a la app con los libros que se encontraron en ella.
// La IA propone; uno confirma con un toque.
import { RotateCw, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { dismissInbox, finishInbox, processInbox, usePendingInbox } from '../app/inbox';
import { useAllBooks, useLibrary } from '../app/library';
import { SHELVES } from '../app/shelves';
import type { Book, Candidate, InboxItem, Status } from '../data';
import { useI18n, type MessageKey } from '../i18n';
import { useInboxImage } from '../sources/images';
import { search } from '../sources/openlibrary';
import { findUrls } from '../sources/text';
import { spring } from '../ui/motion';
import { Candidates } from './Candidates';
import { Segmented } from './Controls';
import { Sheet } from './Sheet';

export function Inbox({ onClose, onOpenAi }: { onClose: () => void; onOpenAi: () => void }) {
  const { t, shelf } = useI18n();
  const items = usePendingInbox();
  const books = useAllBooks() ?? [];
  // Lo que llega desde Instagram suele ser algo que todavía no tengo
  const [status, setStatus] = useState<Status>('wishlist');

  return (
    <Sheet label={t('inbox.title')} onClose={onClose} className="form-sheet inbox-sheet">
      <div className="inbox">
        <h1 className="sheet-title">{t('inbox.title')}</h1>
        {items.length > 0 && (
          <section>
            <h2 className="detail-label">{t('inbox.addTo')}</h2>
            <Segmented
              wrap
              label={t('inbox.addTo')}
              value={status}
              options={SHELVES.map((s) => ({ value: s, label: shelf(s) }))}
              onChange={setStatus}
            />
          </section>
        )}
        {items.length === 0 && <p className="empty-shelf">{t('inbox.empty')}</p>}
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
              transition={spring.sheet}
            >
              <InboxCard item={item} books={books} status={status} onOpenAi={onOpenAi} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}

const METHOD_LABEL: Record<NonNullable<InboxItem['method']>, MessageKey> = {
  isbn: 'inbox.byIsbn',
  ai: 'inbox.byAi',
  ocr: 'inbox.byOcr',
  search: 'inbox.bySearch',
  none: 'inbox.none',
};

function InboxCard({
  item,
  books,
  status,
  onOpenAi,
}: {
  item: InboxItem;
  books: Book[];
  status: Status;
  onOpenAi: () => void;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const image = useInboxImage(item.image_path);
  const [added, setAdded] = useState<Book | null>(null);
  const [query, setQuery] = useState('');
  const [refined, setRefined] = useState<Candidate[] | null>(null);

  useEffect(() => {
    if (!item.identified_at) void processInbox(lib, item.id);
  }, [item.id, item.identified_at]);

  // Buscar a mano si lo encontrado no sirve
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return setRefined(null);
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      void search(q, 8, ctrl.signal)
        .then(setRefined)
        .catch(() => {});
    }, 380);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  const identifying = !item.identified_at;
  const candidates = refined ?? item.candidates;
  const source = item.input ? (findUrls(item.input)[0] ?? null) : null;

  return (
    <article className="inbox-card">
      <div className="inbox-source">
        {image && <img className="inbox-thumb" src={image} alt="" />}
        {item.input && <p className="inbox-text">{item.input}</p>}
      </div>

      <p className="inbox-status" aria-live="polite">
        {identifying ? (
          <span className="pulse">{t('inbox.identifying')}</span>
        ) : (
          t(METHOD_LABEL[item.method ?? 'none'])
        )}
      </p>

      {item.error && (
        <p className="inbox-error">
          {t(`ai.error.${item.error}` as MessageKey)}{' '}
          <button className="link" onClick={onOpenAi}>
            {t('ai.review')}
          </button>
        </p>
      )}

      {!identifying && (
        <>
          <Candidates
            candidates={candidates}
            books={books}
            status={status}
            sourceUrl={source}
            onAdded={setAdded}
          />
          <div className="search inbox-refine">
            <Search size={16} strokeWidth={1.5} aria-hidden />
            <input
              type="search"
              value={query}
              placeholder={item.queries[0] ?? t('inbox.refine')}
              aria-label={t('inbox.refine')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="inbox-actions">
        {!identifying && item.method !== 'ai' && (
          <button
            className="button quiet"
            onClick={() => void lib.resetInbox(item.id)}
            aria-label={t('inbox.retry')}
          >
            <RotateCw size={16} strokeWidth={1.5} aria-hidden />
            {t('inbox.retry')}
          </button>
        )}
        {added ? (
          <button className="button primary" onClick={() => void finishInbox(lib, item, added.id)}>
            {t('inbox.done')}
          </button>
        ) : (
          <button className="button" onClick={() => void dismissInbox(lib, item)}>
            {t('inbox.dismiss')}
          </button>
        )}
      </div>
    </article>
  );
}
