// La bóveda: los EPUB y PDF guardados en el teléfono, cada uno vinculado (o no) a un libro
import { BookOpen, FilePlus2, Link2, Plus, Share2, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAllBooks, useLibrary } from '../app/library';
import { searchBooks } from '../app/shelves';
import type { Book, VaultFile } from '../data';
import { useI18n } from '../i18n';
import { formatSize } from '../sources/epub';
import {
  createBookFromFile,
  importToVault,
  openFile,
  removeFromVault,
  shareFile,
  VaultError,
} from '../sources/vault';
import { spring } from '../ui/motion';
import { Cover } from './Cover';
import { Sheet } from './Sheet';

export const ACCEPT = '.epub,.pdf,application/epub+zip,application/pdf';

export function useFiles(bookId?: string): VaultFile[] | null {
  const lib = useLibrary();
  const [files, setFiles] = useState<VaultFile[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => void lib.listFiles(bookId).then((f) => alive && setFiles(f));
    load();
    const stop = lib.onChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, [lib, bookId]);
  return files;
}

/** Guarda varios archivos y arma un resumen para el aviso */
export function useImport(toast: (m: string) => void) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);

  async function importFiles(list: File[], options: { bookId?: string; books?: Book[] }) {
    let saved = 0;
    let linked = 0;
    let dupes = 0;
    let rejected = 0;
    for (const [i, f] of list.entries()) {
      setBusy(t('vault.saving', { i: i + 1, n: list.length }));
      try {
        const r = await importToVault(lib, f, options);
        if (r.duplicate) dupes++;
        else saved++;
        if (r.book && !r.duplicate) linked++;
      } catch (e) {
        rejected++;
        if (!(e instanceof VaultError)) console.error(e);
      }
    }
    setBusy(null);
    const count = (n: number, key: 'saved' | 'linked' | 'dupes' | 'rejected') =>
      n === 1 ? t(`vault.${key}1`) : n > 1 ? t(`vault.${key}`, { n }) : null;
    const parts = [
      count(saved, 'saved'),
      count(linked, 'linked'),
      count(dupes, 'dupes'),
      count(rejected, 'rejected'),
    ].filter(Boolean);
    toast(parts.join('. '));
  }
  return { busy, importFiles };
}

export function Vault({
  onClose,
  onOpenBook,
  toast,
}: {
  onClose: () => void;
  onOpenBook: (b: Book) => void;
  toast: (m: string, action?: { label: string; run: () => void }) => void;
}) {
  const { t } = useI18n();
  const files = useFiles();
  const books = useAllBooks() ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const { busy, importFiles } = useImport(toast);

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const shown = (files ?? []).filter((f) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    const book = f.book_id ? byId.get(f.book_id) : undefined;
    return [f.filename, f.meta_title, f.meta_author, book?.title, ...(book?.authors ?? [])]
      .filter(Boolean)
      .some((s) => s!.toLowerCase().includes(q));
  });
  const total = (files ?? []).reduce((n, f) => n + f.size, 0);

  return (
    <Sheet label={t('vault.title')} onClose={onClose} className="form-sheet vault-sheet">
      <div className="vault">
        <div className="vault-head">
          <div>
            <h1 className="sheet-title">{t('vault.title')}</h1>
            {files && files.length > 0 && (
              <p className="hint">
                {files.length === 1
                  ? t('vault.summary1', { size: formatSize(total) })
                  : t('vault.summary', { n: files.length, size: formatSize(total) })}
              </p>
            )}
          </div>
          <button
            className="button primary"
            onClick={() => input.current?.click()}
            disabled={!!busy}
          >
            <Plus size={18} strokeWidth={2} aria-hidden />
            {t('vault.add')}
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
              if (list.length) void importFiles(list, { books });
            }}
          />
        </div>

        {busy && <p className="hint pulse">{busy}</p>}
        {files && files.length === 0 && !busy && <p className="empty-shelf">{t('vault.empty')}</p>}
        {files && files.length > 6 && (
          <input
            className="field"
            type="search"
            value={filter}
            placeholder={t('vault.filter')}
            aria-label={t('vault.filter')}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}

        <ul className="files">
          <AnimatePresence initial={false}>
            {shown.map((f) => (
              <motion.li
                key={f.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
                transition={spring.sheet}
              >
                <FileRow
                  file={f}
                  book={f.book_id ? byId.get(f.book_id) : undefined}
                  books={books}
                  onOpenBook={onOpenBook}
                  toast={toast}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </Sheet>
  );
}

export function FileRow({
  file,
  book,
  books,
  onOpenBook,
  toast,
  compact = false,
}: {
  file: VaultFile;
  book?: Book;
  books: Book[];
  onOpenBook?: (b: Book) => void;
  toast: (m: string, action?: { label: string; run: () => void }) => void;
  /** En la ficha del libro: sin la parte del vínculo */
  compact?: boolean;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [linking, setLinking] = useState(false);

  async function open() {
    const result = await openFile(file);
    if (result === 'no-reader') toast(t('vault.noReader'));
    if (result === 'missing') toast(t('vault.missing'));
  }

  async function share() {
    try {
      if ((await shareFile(file)) === 'missing') toast(t('vault.missing'));
    } catch {
      toast(t('share.failed'));
    }
  }

  async function remove() {
    await removeFromVault(lib, file);
    toast(t('vault.removed', { name: file.meta_title ?? file.filename }), {
      label: t('book.undo'),
      run: () => void lib.restoreFile(file.id),
    });
  }

  return (
    <div className="file-row">
      <div className="file-main">
        <span className={`file-format ${file.format}`}>{file.format.toUpperCase()}</span>
        <div className="file-text">
          <span className="file-title">{file.meta_title ?? file.filename}</span>
          <span className="file-meta">
            {[file.meta_author, formatSize(file.size)].filter(Boolean).join(', ')}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="file-book">
          {book ? (
            <button className="file-linked" onClick={() => onOpenBook?.(book)}>
              <span className="file-linked-cover">
                <Cover book={book} />
              </span>
              <span>{book.title}</span>
            </button>
          ) : (
            <span className="file-unlinked">{t('vault.unlinked')}</span>
          )}
          <button className="button quiet" onClick={() => setLinking(!linking)}>
            <Link2 size={16} strokeWidth={1.5} aria-hidden />
            {book ? t('vault.relink') : t('vault.link')}
          </button>
        </div>
      )}

      {linking && (
        <LinkPicker
          file={file}
          books={books}
          onDone={(b) => {
            setLinking(false);
            toast(t('vault.linkedTo', { title: b.title }));
          }}
        />
      )}

      <div className="file-actions">
        <button className="button" onClick={() => void open()}>
          <BookOpen size={16} strokeWidth={1.5} aria-hidden />
          {t('vault.open')}
        </button>
        <button className="icon-button" onClick={() => void share()} aria-label={t('vault.share')}>
          <Share2 size={18} strokeWidth={1.5} />
        </button>
        <button
          className="icon-button"
          onClick={() => void remove()}
          aria-label={t('vault.remove')}
        >
          <Trash2 size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/** Elegir a qué libro de la biblioteca pertenece un archivo, o crear la ficha desde el archivo */
function LinkPicker({
  file,
  books,
  onDone,
}: {
  file: VaultFile;
  books: Book[];
  onDone: (b: Book) => void;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [query, setQuery] = useState(file.meta_title ?? '');
  const [creating, setCreating] = useState(false);
  const matches = useMemo(() => searchBooks(books, query).slice(0, 5), [books, query]);

  return (
    <motion.div
      className="link-picker"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={spring.sheet}
    >
      <input
        className="field"
        type="search"
        value={query}
        placeholder={t('vault.searchBook')}
        aria-label={t('vault.searchBook')}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <ul className="link-results">
        {matches.map((b) => (
          <li key={b.id}>
            <button
              onClick={() => void lib.linkFile(file.id, b.id).then(() => onDone(b))}
              className="link-result"
            >
              <span className="file-linked-cover">
                <Cover book={b} />
              </span>
              <span className="link-result-text">
                <span>{b.title}</span>
                <span className="file-meta">{b.authors[0]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        className="button quiet"
        disabled={creating}
        onClick={async () => {
          setCreating(true);
          onDone(await createBookFromFile(lib, file));
        }}
      >
        <FilePlus2 size={16} strokeWidth={1.5} aria-hidden />
        {creating ? t('add.searching') : t('vault.createBook')}
      </button>
    </motion.div>
  );
}
