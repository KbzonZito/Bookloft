// Acciones rápidas al mantener presionado un libro: lo más común sin abrir la ficha
import { Share as NativeShare } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { BookCheck, BookOpen, Check, ImageUp, ListPlus, Share2, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLibrary } from '../app/library';
import { STATUS_ORDER } from '../app/shelves';
import type { Book } from '../data';
import { useI18n } from '../i18n';
import { CoverPicker } from './BookEdit';
import { Rating, Segmented } from './Controls';
import { Cover } from './Cover';
import { Sheet } from './Sheet';

export function QuickActions({
  book,
  onClose,
  onDelete,
  toast,
}: {
  book: Book;
  onClose: () => void;
  onDelete: (b: Book) => void;
  toast: (m: string) => void;
}) {
  const lib = useLibrary();
  const { t, status } = useI18n();
  const [cover, setCover] = useState(false);

  const act = async (fn: () => Promise<unknown>, message?: string) => {
    await fn();
    if (message) toast(message);
    onClose();
  };

  async function share() {
    const text = [book.title, book.authors[0]].filter(Boolean).join(' — ');
    try {
      if (Capacitor.isNativePlatform()) await NativeShare.share({ text });
      else if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t('quick.copied'));
      }
    } catch {
      // Cerrar la hoja de compartir no es un error
    }
  }

  return (
    <Sheet label={book.title} onClose={onClose} className="form-sheet quick-sheet">
      <div className="quick">
        <div className="quick-head">
          <span className="quick-cover">
            <Cover book={book} />
          </span>
          <span className="quick-titles">
            <span className="quick-title">{book.title}</span>
            <span className="quick-author">{book.authors.join(', ')}</span>
          </span>
        </div>

        <div className="quick-actions">
          {book.status !== 'reading' && (
            <button
              className="quick-action"
              onClick={() =>
                void act(
                  () => lib.updateBook(book.id, { status: 'reading' }),
                  t('next.started', { title: book.title }),
                )
              }
            >
              <BookOpen size={20} strokeWidth={1.6} aria-hidden />
              {t('quick.start')}
            </button>
          )}
          {book.status !== 'read' && (
            <button
              className="quick-action"
              onClick={() =>
                void act(
                  () => lib.updateBook(book.id, { status: 'read' }),
                  t('quick.finished', { title: book.title }),
                )
              }
            >
              <BookCheck size={20} strokeWidth={1.6} aria-hidden />
              {t('quick.finish')}
            </button>
          )}
          {book.status !== 'reading' && (
            <button
              className="quick-action"
              onClick={() =>
                void act(
                  () => lib.setUpNext(book.id, book.up_next == null),
                  book.up_next == null ? t('upnext.added', { title: book.title }) : undefined,
                )
              }
            >
              {book.up_next != null ? (
                <Check size={20} strokeWidth={2} aria-hidden />
              ) : (
                <ListPlus size={20} strokeWidth={1.6} aria-hidden />
              )}
              {book.up_next != null ? t('quick.removeUpNext') : t('upnext.add')}
            </button>
          )}
          <button className="quick-action" onClick={() => setCover(true)}>
            <ImageUp size={20} strokeWidth={1.6} aria-hidden />
            {t('cover.change')}
          </button>
          <button className="quick-action" onClick={() => void share()}>
            <Share2 size={20} strokeWidth={1.6} aria-hidden />
            {t('quick.share')}
          </button>
          <button
            className="quick-action danger"
            onClick={() => {
              onClose();
              onDelete(book);
            }}
          >
            <Trash2 size={20} strokeWidth={1.6} aria-hidden />
            {t('quick.delete')}
          </button>
        </div>

        <section>
          <h2 className="detail-label">{t('book.rating')}</h2>
          <Rating
            value={book.rating}
            onChange={(rating) => void lib.updateBook(book.id, { rating })}
          />
        </section>

        <section>
          <h2 className="detail-label">{t('quick.move')}</h2>
          <Segmented
            wrap
            label={t('quick.move')}
            value={book.status}
            options={STATUS_ORDER.map((s) => ({ value: s, label: status(s) }))}
            onChange={(s) => void act(() => lib.updateBook(book.id, { status: s }))}
          />
        </section>
      </div>
      {createPortal(
        <AnimatePresence>
          {cover && (
            <CoverPicker
              book={book}
              onClose={() => {
                setCover(false);
                onClose();
              }}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Sheet>
  );
}
