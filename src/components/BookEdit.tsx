// Cambiar la portada (otra edición, Apple Books, un link o una imagen propia) y corregir los datos
import { Check, ImagePlus, Link2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLibrary } from '../app/library';
import type { Book } from '../data';
import { useI18n } from '../i18n';
import {
  completeBook,
  coverOptions,
  setCoverUrl,
  setCustomCover,
  type CoverOption,
} from '../sources/covers';
import { spring } from '../ui/motion';
import { bookCover, Cover } from './Cover';
import { Sheet } from './Sheet';

export function CoverPicker({ book, onClose }: { book: Book; onClose: () => void }) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [options, setOptions] = useState<CoverOption[] | null>(null);
  const [link, setLink] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const current = bookCover(book);

  useEffect(() => {
    void coverOptions(book).then(setOptions);
  }, [book.id]);

  const choose = async (url: string) => {
    await setCoverUrl(lib, book, url);
    onClose();
  };

  return (
    <Sheet label={t('cover.title')} onClose={onClose} className="form-sheet cover-sheet">
      <div className="cover-picker">
        <h1 className="sheet-title">{t('cover.title')}</h1>

        <div className="cover-actions">
          <button className="button" onClick={() => file.current?.click()}>
            <ImagePlus size={18} strokeWidth={1.5} aria-hidden />
            {t('cover.fromImage')}
          </button>
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              await setCustomCover(lib, book, f);
              onClose();
            }}
          />
        </div>

        <form
          className="search cover-link"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (/^https?:\/\/\S+$/.test(link.trim())) void choose(link.trim());
          }}
        >
          <Link2 size={16} strokeWidth={1.5} aria-hidden />
          <input
            type="url"
            value={link}
            placeholder={t('cover.link')}
            aria-label={t('cover.link')}
            enterKeyHint="done"
            onChange={(e) => setLink(e.target.value)}
          />
          {link.trim() && (
            <button className="icon-button small" aria-label={t('cover.useLink')}>
              <Check size={18} strokeWidth={2} />
            </button>
          )}
        </form>

        <h2 className="detail-label">{t('cover.options')}</h2>
        {options === null && <p className="hint pulse">{t('add.searching')}</p>}
        {options?.length === 0 && <p className="hint">{t('cover.none')}</p>}
        <div className="cover-grid">
          {options?.map((o, i) => (
            <motion.button
              key={o.url}
              className={`cover-option ${current?.startsWith(o.url.replace('-M.jpg', '')) ? 'current' : ''}`}
              onClick={() => void choose(o.url)}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring.sheet, delay: Math.min(i, 12) * 0.02 }}
              aria-label={t(o.source === 'apple' ? 'cover.fromApple' : 'cover.fromOl')}
            >
              <Cover book={{ ...book, cover_url: o.url, cover_path: null }} />
              <span className="cover-source">
                {o.source === 'apple' ? 'Apple' : 'Open Library'}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

export function EditBook({
  book,
  onClose,
  toast,
}: {
  book: Book;
  onClose: () => void;
  toast: (message: string) => void;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [completing, setCompleting] = useState(false);
  const incomplete = !book.authors.length || (!book.cover_url && !book.cover_path) || !book.ol_key;
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState(book.authors.join(', '));
  const [series, setSeries] = useState(book.series ?? '');
  const [index, setIndex] = useState(book.series_index?.toString() ?? '');
  const [year, setYear] = useState(book.year?.toString() ?? '');

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const num = (v: string) => {
      const n = Number.parseFloat(v.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    await lib.updateBook(book.id, {
      title: title.trim(),
      authors: authors
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      series: series.trim() || null,
      series_index: series.trim() ? num(index) : null,
      year: num(year),
    });
    onClose();
  }

  return (
    <Sheet label={t('edit.title')} onClose={onClose} className="form-sheet">
      <form className="add-form" onSubmit={save}>
        <h1 className="sheet-title">{t('edit.title')}</h1>
        <label className="field-label">
          {t('add.bookTitle')}
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field-label">
          {t('edit.authors')}
          <input className="field" value={authors} onChange={(e) => setAuthors(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field-label grow">
            {t('edit.series')}
            <input
              className="field"
              value={series}
              placeholder={t('edit.seriesNone')}
              onChange={(e) => setSeries(e.target.value)}
            />
          </label>
          <label className="field-label number">
            {t('edit.number')}
            <input
              className="field"
              inputMode="decimal"
              value={index}
              onChange={(e) => setIndex(e.target.value)}
            />
          </label>
        </div>
        <label className="field-label number">
          {t('edit.year')}
          <input
            className="field"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <button className="button primary" disabled={!title.trim()}>
          {t('edit.save')}
        </button>
        {incomplete && (
          <button
            type="button"
            className="button quiet complete-toggle"
            disabled={completing}
            onClick={async () => {
              setCompleting(true);
              const n = await completeBook(lib, book);
              setCompleting(false);
              toast(n ? t('edit.completed', { n }) : t('edit.notFound'));
              if (n) onClose();
            }}
          >
            <Sparkles size={16} strokeWidth={1.5} aria-hidden />
            {completing ? t('add.searching') : t('edit.complete')}
          </button>
        )}
      </form>
    </Sheet>
  );
}
