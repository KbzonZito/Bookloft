// Pantalla Descubrir: filas de portadas (para ti, más vendidos, tendencias) y una hoja para
// mirar un libro y agregarlo a la Estantería o a Próximos.
import { Check, ListPlus, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../app/library';
import type { Book } from '../data';
import { useI18n } from '../i18n';
import { ensureCover } from '../sources/covers';
import { plainText } from '../sources/details';
import {
  bestsellers,
  forYou,
  owned,
  trending,
  type DiscoverItem,
  type DiscoverRow,
} from '../sources/discover';
import { spring } from '../ui/motion';
import { Cover } from './Cover';
import { Sheet } from './Sheet';

type Load<T> = T | 'loading' | 'error';

export function Discover({ books, toast }: { books: Book[]; toast: (m: string) => void }) {
  const { t } = useI18n();
  const [mine, setMine] = useState<Load<DiscoverRow[]>>('loading');
  const [top, setTop] = useState<Load<DiscoverItem[]>>('loading');
  const [hot, setHot] = useState<Load<DiscoverItem[]>>('loading');
  const [genre, setGenre] = useState<string | null>(null);
  const [preview, setPreview] = useState<DiscoverItem | null>(null);

  useEffect(() => {
    void forYou(books).then(setMine, () => setMine('error'));
    void bestsellers().then(setTop, () => setTop('error'));
    void trending().then(setHot, () => setHot('error'));
    // Se calcula una vez al entrar: agregar un libro no tiene que reordenar todo
  }, []);

  const genres = useMemo(() => {
    if (!Array.isArray(top)) return [];
    const count = new Map<string, number>();
    for (const i of top) if (i.genre) count.set(i.genre, (count.get(i.genre) ?? 0) + 1);
    return [...count]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g]) => g);
  }, [top]);
  const topShown = Array.isArray(top) ? top.filter((i) => !genre || i.genre === genre) : top;

  const offline = mine === 'error' && top === 'error' && hot === 'error';

  return (
    <div className="discover">
      {offline && <p className="hint">{t('discover.offline')}</p>}

      {Array.isArray(mine) && mine.length > 0 && (
        <>
          <h2 className="discover-section">{t('discover.forYou')}</h2>
          {mine.map((row) => (
            <Row
              key={row.id}
              title={
                row.id.startsWith('author-')
                  ? t('discover.byAuthor', { author: row.title })
                  : t('discover.inGenre', { genre: row.title })
              }
              items={row.items}
              books={books}
              onOpen={setPreview}
            />
          ))}
        </>
      )}
      {mine === 'loading' && <RowSkeleton title={t('discover.forYou')} />}

      {top !== 'error' && (
        <>
          <h2 className="discover-section">{t('discover.bestsellers')}</h2>
          {genres.length > 1 && (
            <div className="filter-chips">
              <button
                className={`chip ${genre === null ? 'active' : ''}`}
                onClick={() => setGenre(null)}
              >
                {t('shelf.all')}
              </button>
              {genres.map((g) => (
                <button
                  key={g}
                  className={`chip ${genre === g ? 'active' : ''}`}
                  onClick={() => setGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
          {Array.isArray(topShown) ? (
            <Row items={topShown} books={books} onOpen={setPreview} ranked={!genre} />
          ) : (
            <RowSkeleton />
          )}
        </>
      )}

      {hot !== 'error' && (
        <>
          <h2 className="discover-section">{t('discover.trending')}</h2>
          {Array.isArray(hot) ? (
            <Row items={hot} books={books} onOpen={setPreview} />
          ) : (
            <RowSkeleton />
          )}
        </>
      )}

      <p className="hint info-source">{t('discover.source')}</p>

      <AnimatePresence>
        {preview && (
          <Preview item={preview} books={books} toast={toast} onClose={() => setPreview(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  title,
  items,
  books,
  onOpen,
  ranked = false,
}: {
  title?: string;
  items: DiscoverItem[];
  books: Book[];
  onOpen: (i: DiscoverItem) => void;
  ranked?: boolean;
}) {
  return (
    <section className="discover-row">
      {title && <h3 className="series-name">{title}</h3>}
      <div className="series-strip">
        {items.slice(0, 20).map((item, i) => (
          <motion.button
            key={item.key}
            className="book-cell discover-cell"
            onClick={() => onOpen(item)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.sheet, delay: Math.min(i, 6) * 0.03 }}
          >
            <div className="cover-wrap">
              <Cover
                book={{
                  title: item.title,
                  authors: item.author ? [item.author] : [],
                  cover_url: item.cover_url,
                  cover_path: null,
                }}
              />
              {ranked && <span className="rank">{i + 1}</span>}
              {owned(books, item) && (
                <span className="owned" aria-hidden>
                  <Check size={14} strokeWidth={2.5} />
                </span>
              )}
            </div>
            <span className="book-title">{item.title}</span>
            <span className="book-meta">{item.author}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

function RowSkeleton({ title }: { title?: string }) {
  return (
    <section className="discover-row" aria-hidden>
      {title && <h2 className="discover-section">{title}</h2>}
      <div className="series-strip">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="book-cell">
            <div className="cover skeleton" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Mirar un libro de Descubrir y agregarlo */
function Preview({
  item,
  books,
  toast,
  onClose,
}: {
  item: DiscoverItem;
  books: Book[];
  toast: (m: string) => void;
  onClose: () => void;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [summary, setSummary] = useState(item.summary ? plainText(item.summary) : null);
  const isOwned = owned(books, item);

  // Open Library no trae reseña en la lista: se pide la de la obra
  useEffect(() => {
    if (summary || !item.ol_key) return;
    void fetch(`https://openlibrary.org${item.ol_key}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((w: { description?: string | { value?: string } } | null) => {
        const d = typeof w?.description === 'string' ? w.description : w?.description?.value;
        if (d) setSummary(plainText(d));
      })
      .catch(() => {});
  }, [item.key]);

  async function add(upNext: boolean) {
    const { book, duplicate } = await lib.addBook(
      {
        title: item.title,
        authors: item.author ? [item.author] : [],
        year: item.year,
        cover_url: item.cover_url,
        ol_key: item.ol_key,
        isbn: item.isbn,
        pages: null,
      },
      { status: 'to_read' },
    );
    if (!duplicate) void ensureCover(lib, book);
    if (upNext) await lib.setUpNext(book.id, true);
    toast(
      upNext
        ? t('upnext.added', { title: book.title })
        : t('discover.added', { title: book.title }),
    );
    onClose();
  }

  return (
    <Sheet label={item.title} onClose={onClose} className="form-sheet discover-preview">
      <div className="preview">
        <div className="preview-head">
          <span className="preview-cover">
            <Cover
              book={{
                title: item.title,
                authors: item.author ? [item.author] : [],
                cover_url: item.cover_url,
                cover_path: null,
              }}
              size="L"
            />
          </span>
          <span className="preview-titles">
            <span className="quick-title">{item.title}</span>
            {item.author && <span className="quick-author">{item.author}</span>}
            {(item.genre || item.year) && (
              <span className="info-votes">
                {[item.genre, item.year].filter(Boolean).join(' · ')}
              </span>
            )}
          </span>
        </div>
        {summary && <p className="description clamped preview-summary">{summary}</p>}
        {isOwned ? (
          <p className="hint">{t('discover.owned')}</p>
        ) : (
          <div className="preview-actions">
            <button className="button primary" onClick={() => void add(false)}>
              <Plus size={18} strokeWidth={2} aria-hidden />
              {t('discover.add')}
            </button>
            <button className="button" onClick={() => void add(true)}>
              <ListPlus size={18} strokeWidth={1.6} aria-hidden />
              {t('upnext.add')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
