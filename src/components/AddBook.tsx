// Agregar un libro: buscar en Open Library, escanear el ISBN, leer una imagen o un texto pegado,
// o, si nada de eso sirve, escribirlo a mano.
import { ImagePlus, PenLine, ScanBarcode, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addToInbox } from '../app/inbox';
import { useAllBooks, useLibrary } from '../app/library';
import { SHELVES } from '../app/shelves';
import type { Candidate, Status } from '../data';
import { useI18n } from '../i18n';
import { byIsbn, search } from '../sources/openlibrary';
import { ensureCover } from '../sources/covers';
import { canScan, scanIsbn } from '../sources/scan';
import { findIsbns, findUrls } from '../sources/text';
import { fade } from '../ui/motion';
import { Candidates } from './Candidates';
import { Segmented } from './Controls';
import { Sheet } from './Sheet';

type Results =
  | { state: 'idle' }
  | { state: 'searching' }
  | { state: 'done'; candidates: Candidate[] }
  | { state: 'error' };

/** Un link, varias líneas o un texto largo no se buscan tal cual: van a la bandeja a identificarse */
const looksShared = (q: string) => findUrls(q).length > 0 || q.includes('\n') || q.length > 90;

export function AddBook({
  initialShelf,
  onClose,
  onAdded,
  onToInbox,
  toast,
}: {
  initialShelf: Status;
  onClose: () => void;
  onAdded: (message: string, shelf: Status) => void;
  onToInbox: () => void;
  toast: (message: string) => void;
}) {
  const lib = useLibrary();
  const books = useAllBooks() ?? [];
  const { t, shelf } = useI18n();
  const [status, setStatus] = useState<Status>(initialShelf);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>({ state: 'idle' });
  const [manual, setManual] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  // Buscar mientras se escribe, con una pausa para no consultar en cada tecla
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || looksShared(q)) return setResults({ state: 'idle' });
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setResults({ state: 'searching' });
      try {
        const isbn = findIsbns(q)[0];
        const candidates = isbn
          ? [await byIsbn(isbn, ctrl.signal)].filter((c): c is Candidate => c !== null)
          : await search(q, 12, ctrl.signal);
        setResults({ state: 'done', candidates });
      } catch {
        if (!ctrl.signal.aborted) setResults({ state: 'error' });
      }
    }, 380);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  async function sendToInbox(input: { text?: string; image?: Blob }) {
    await addToInbox(lib, input);
    onToInbox();
  }

  async function scan() {
    const isbn = await scanIsbn(() => toast(t('add.scannerInstalling')));
    if (isbn) setQuery(isbn);
  }

  return (
    <Sheet label={t('add.title')} onClose={onClose} className="form-sheet add-sheet">
      <div className="add-form">
        <h1 className="sheet-title">{t('add.title')}</h1>

        <form
          className="search add-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (looksShared(query.trim())) void sendToInbox({ text: query });
          }}
        >
          <Search size={18} strokeWidth={1.5} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder={t('add.searchPlaceholder')}
            aria-label={t('add.searchPlaceholder')}
            autoFocus
            enterKeyHint="search"
            onChange={(e) => setQuery(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (looksShared(pasted.trim())) {
                e.preventDefault();
                void sendToInbox({ text: pasted });
              }
            }}
          />
        </form>

        <Segmented
          wrap
          label={t('add.shelf')}
          value={status}
          options={SHELVES.map((s) => ({ value: s, label: shelf(s) }))}
          onChange={setStatus}
        />

        <div className="add-actions">
          {canScan && (
            <button className="button" onClick={() => void scan()}>
              <ScanBarcode size={18} strokeWidth={1.5} aria-hidden />
              {t('add.scan')}
            </button>
          )}
          <button className="button" onClick={() => file.current?.click()}>
            <ImagePlus size={18} strokeWidth={1.5} aria-hidden />
            {t('add.fromImage')}
          </button>
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void sendToInbox({ image: f });
            }}
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={results.state}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fade}
          >
            {results.state === 'idle' && <p className="hint">{t('add.hint')}</p>}
            {results.state === 'searching' && <p className="hint">{t('add.searching')}</p>}
            {results.state === 'error' && <p className="hint">{t('add.offline')}</p>}
            {results.state === 'done' && (
              <>
                {results.candidates.length === 0 && (
                  <p className="hint">{t('add.noResults', { q: query.trim() })}</p>
                )}
                <Candidates
                  candidates={results.candidates}
                  books={books}
                  status={status}
                  onAdded={(b) =>
                    onAdded(t('add.added', { title: b.title, shelf: shelf(status) }), status)
                  }
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {manual ? (
          <ManualForm
            initialTitle={query.trim()}
            onSubmit={async (title, author) => {
              const { book, duplicate } = await lib.addBook(
                {
                  title,
                  authors: author ? [author] : [],
                  year: null,
                  cover_url: null,
                  ol_key: null,
                  isbn: null,
                  pages: null,
                },
                { status },
              );
              if (!duplicate) void ensureCover(lib, book);
              onAdded(
                duplicate
                  ? t('add.duplicate', { title: book.title })
                  : t('add.added', { title: book.title, shelf: shelf(book.status) }),
                book.status,
              );
            }}
          />
        ) : (
          <button className="button quiet manual-toggle" onClick={() => setManual(true)}>
            <PenLine size={16} strokeWidth={1.5} aria-hidden />
            {t('add.manual')}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function ManualForm({
  initialTitle,
  onSubmit,
}: {
  initialTitle: string;
  onSubmit: (title: string, author: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) void onSubmit(title.trim(), author.trim());
  };
  return (
    <motion.form
      className="manual-form"
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={fade}
    >
      <input
        className="field"
        placeholder={t('add.bookTitle')}
        aria-label={t('add.bookTitle')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <input
        className="field"
        placeholder={t('add.author')}
        aria-label={t('add.author')}
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <button className="button primary" disabled={!title.trim()}>
        {t('add.save')}
      </button>
    </motion.form>
  );
}
