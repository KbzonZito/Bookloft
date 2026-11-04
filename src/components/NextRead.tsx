// "¿Qué leo ahora?": tres propuestas al tiro (reglas simples: sagas en curso, prioridad, autores
// que te gustaron) y, si conectaste la IA, la opción de pedirle a Claude que elija.
import { BookOpen, Check, ListPlus, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '../app/library';
import { rankCandidates, suggestNext, type Suggestion } from '../app/reading';
import type { Book } from '../data';
import { useI18n, type MessageKey } from '../i18n';
import { AiError, getApiKey, suggestWithAi } from '../sources/ai';
import { fade, spring } from '../ui/motion';
import { Cover } from './Cover';
import { Sheet } from './Sheet';

type Pick = { book: Book; reason: string };

export function NextRead({
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
  const lib = useLibrary();
  const { t, lang } = useI18n();
  const [hasKey, setHasKey] = useState(false);
  const [ai, setAi] = useState<'idle' | 'thinking' | Pick[]>('idle');
  const [queued, setQueued] = useState<Set<string>>(new Set());
  useEffect(() => void getApiKey().then((k) => setHasKey(!!k)), []);

  // Las propuestas se calculan una vez al abrir: si empiezas uno, la lista no salta
  const [rules] = useState(() => suggestNext(books));
  const reasonText = (s: Suggestion) =>
    s.reasons.map((r) => t(r.key as MessageKey, r.vars)).join(' · ');

  const picks: Pick[] = useMemo(
    () => (Array.isArray(ai) ? ai : rules.map((s) => ({ book: s.book, reason: reasonText(s) }))),
    [ai, rules, lang],
  );

  async function askAi() {
    const key = await getApiKey();
    if (!key) return;
    setAi('thinking');
    try {
      const ranked = rankCandidates(books).slice(0, 80);
      const line = (b: Book) =>
        [b.title, b.authors[0], b.series && `${b.series} #${b.series_index ?? '?'}`]
          .filter(Boolean)
          .join(' · ');
      const recent = books
        .filter((b) => b.status === 'read' && b.finished_at)
        .sort((a, b) => b.finished_at!.localeCompare(a.finished_at!))
        .slice(0, 15)
        .map((b) => `${line(b)}${b.rating ? ` · ${b.rating}/5` : ''}`);
      const result = await suggestWithAi(key, {
        lang,
        candidates: ranked.map((s) => ({
          id: s.book.id,
          line: [
            line(s.book),
            s.book.pages && `${s.book.pages} p.`,
            s.reasons.map((r) => t(r.key as MessageKey, r.vars)).join(', '),
          ]
            .filter(Boolean)
            .join(' | '),
        })),
        recent,
        reading: books.filter((b) => b.status === 'reading').map(line),
      });
      const byId = new Map(books.map((b) => [b.id, b]));
      const chosen = result.flatMap((p) => {
        const book = byId.get(p.id);
        return book ? [{ book, reason: p.reason }] : [];
      });
      setAi(chosen.length ? chosen : 'idle');
      if (!chosen.length) toast(t('next.aiEmpty'));
    } catch (e) {
      setAi('idle');
      toast(t(`ai.error.${e instanceof AiError ? e.kind : 'other'}`));
    }
  }

  async function start(b: Book) {
    await lib.updateBook(b.id, { status: 'reading' });
    toast(t('next.started', { title: b.title }));
    onClose();
  }

  return (
    <Sheet label={t('next.title')} onClose={onClose} className="form-sheet next-sheet">
      <div className="next-read">
        <h1 className="sheet-title">{t('next.title')}</h1>
        <p className="hint">{Array.isArray(ai) ? t('next.byAi') : t('next.byRules')}</p>

        {picks.length === 0 && <p className="hint">{t('next.empty')}</p>}

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.ol
            key={Array.isArray(ai) ? 'ai' : 'rules'}
            className="next-list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: fade }}
            transition={spring.sheet}
          >
            {picks.map(({ book, reason }) => (
              <li key={book.id} className="next-item">
                <button
                  className="next-book"
                  onClick={() => {
                    onClose();
                    onOpenBook(book);
                  }}
                >
                  <span className="next-cover">
                    <Cover book={book} />
                  </span>
                  <span className="next-text">
                    <span className="next-title">{book.title}</span>
                    <span className="next-author">{book.authors[0]}</span>
                    {reason && <span className="next-reason">{reason}</span>}
                  </span>
                </button>
                <span className="next-buttons">
                  <button className="button quiet next-start" onClick={() => void start(book)}>
                    <BookOpen size={16} strokeWidth={1.6} aria-hidden />
                    {t('next.start')}
                  </button>
                  <button
                    className="button quiet next-start"
                    disabled={queued.has(book.id) || book.up_next != null}
                    onClick={async () => {
                      await lib.setUpNext(book.id, true);
                      setQueued((q) => new Set(q).add(book.id));
                    }}
                  >
                    {queued.has(book.id) || book.up_next != null ? (
                      <Check size={16} strokeWidth={2} aria-hidden />
                    ) : (
                      <ListPlus size={16} strokeWidth={1.6} aria-hidden />
                    )}
                    {queued.has(book.id) || book.up_next != null
                      ? t('upnext.inList')
                      : t('upnext.add')}
                  </button>
                </span>
              </li>
            ))}
          </motion.ol>
        </AnimatePresence>

        {hasKey && picks.length > 0 && !Array.isArray(ai) && (
          <button className="button" disabled={ai === 'thinking'} onClick={() => void askAi()}>
            <Sparkles size={18} strokeWidth={1.5} aria-hidden />
            {ai === 'thinking' ? t('next.thinking') : t('next.askAi')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
