// Próximos: la fila de lo que quiero leer después, dentro de Leyendo. Se ordena a mano y se llena
// desde la ficha, desde las acciones rápidas o con "¿Qué leo ahora?".
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLibrary } from '../app/library';
import type { Book } from '../data';
import { useI18n } from '../i18n';
import { fade, spring } from '../ui/motion';
import { Cover } from './Cover';

export function UpNext({
  books,
  onOpen,
  onSuggest,
  canSuggest,
}: {
  books: Book[];
  onOpen: (b: Book) => void;
  onSuggest: () => void;
  canSuggest: boolean;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  return (
    <section className="up-next">
      <div className="up-next-head">
        <h2 className="up-next-title">{t('upnext.title')}</h2>
        {canSuggest && (
          <button className="next-banner" onClick={onSuggest}>
            <Sparkles size={16} strokeWidth={1.6} aria-hidden />
            <span>{t('next.title')}</span>
          </button>
        )}
      </div>
      {books.length === 0 && <p className="hint">{t('upnext.empty')}</p>}
      <ol className="up-next-list">
        <AnimatePresence initial={false}>
          {books.map((b, i) => (
            <motion.li
              key={b.id}
              layout
              className="up-next-item"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: fade }}
              transition={spring.snappy}
            >
              <span className="up-next-n" aria-hidden>
                {i + 1}
              </span>
              <button className="up-next-book" onClick={() => onOpen(b)}>
                <span className="up-next-cover">
                  <Cover book={b} />
                </span>
                <span className="up-next-text">
                  <span className="up-next-name">{b.title}</span>
                  <span className="up-next-author">{b.authors[0]}</span>
                </span>
              </button>
              <span className="up-next-actions">
                <button
                  className="icon-button small"
                  aria-label={t('upnext.up')}
                  disabled={i === 0}
                  onClick={() => void lib.moveUpNext(b.id, -1)}
                >
                  <ChevronUp size={18} strokeWidth={1.6} />
                </button>
                <button
                  className="icon-button small"
                  aria-label={t('upnext.down')}
                  disabled={i === books.length - 1}
                  onClick={() => void lib.moveUpNext(b.id, 1)}
                >
                  <ChevronDown size={18} strokeWidth={1.6} />
                </button>
                <button
                  className="icon-button small"
                  aria-label={t('upnext.remove', { title: b.title })}
                  onClick={() => void lib.setUpNext(b.id, false)}
                >
                  <X size={16} strokeWidth={1.6} />
                </button>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  );
}
