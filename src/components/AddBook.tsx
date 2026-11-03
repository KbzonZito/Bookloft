// Agregar a mano por título y autor. La búsqueda en Open Library, el ISBN y compartir llegan en la Fase 3.
import { useState, type FormEvent } from 'react';
import { useLibrary } from '../app/library';
import { SHELVES } from '../app/shelves';
import type { Status } from '../data';
import { useI18n } from '../i18n';
import { Segmented } from './Controls';
import { Sheet } from './Sheet';

export function AddBook({
  initialShelf,
  onClose,
  onAdded,
}: {
  initialShelf: Status;
  onClose: () => void;
  onAdded: (message: string, shelf: Status) => void;
}) {
  const lib = useLibrary();
  const { t, shelf } = useI18n();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<Status>(initialShelf);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { book, duplicate } = await lib.addBook(
      {
        title: title.trim(),
        authors: author.trim() ? [author.trim()] : [],
        year: null,
        cover_url: null,
        ol_key: null,
        isbn: null,
        pages: null,
      },
      { status },
    );
    onAdded(
      duplicate
        ? t('add.duplicate', { title: book.title })
        : t('add.added', { title: book.title, shelf: shelf(book.status) }),
      book.status,
    );
  }

  return (
    <Sheet label={t('add.title')} onClose={onClose} className="form-sheet">
      <form className="add-form" onSubmit={submit}>
        <h1 className="sheet-title">{t('add.title')}</h1>
        <input
          className="field"
          placeholder={t('add.bookTitle')}
          aria-label={t('add.bookTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          enterKeyHint="next"
        />
        <input
          className="field"
          placeholder={t('add.author')}
          aria-label={t('add.author')}
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          enterKeyHint="done"
        />
        <Segmented
          wrap
          label={t('add.shelf')}
          value={status}
          options={SHELVES.map((s) => ({ value: s, label: shelf(s) }))}
          onChange={setStatus}
        />
        <p className="hint">{t('add.searchSoon')}</p>
        <button className="button primary" disabled={!title.trim()}>
          {t('add.save')}
        </button>
      </form>
    </Sheet>
  );
}
