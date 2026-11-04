// Novedades: aparece una vez después de actualizar la app, con lo nuevo de cada versión
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { ChangelogSection } from '../app/whats-new';
import { plain } from '../app/whats-new';
import { useI18n } from '../i18n';
import { spring } from '../ui/motion';
import { Sheet } from './Sheet';

export function WhatsNew({
  sections,
  onClose,
}: {
  sections: ChangelogSection[];
  onClose: () => void;
}) {
  const { t, date } = useI18n();
  return (
    <Sheet label={t('news.title')} onClose={onClose} className="form-sheet news-sheet">
      <div className="news">
        <h1 className="sheet-title">
          <Sparkles size={20} strokeWidth={1.6} aria-hidden /> {t('news.title')}
        </h1>
        {sections.map((s, i) => (
          <motion.section
            key={s.version}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.sheet, delay: 0.05 + i * 0.05 }}
          >
            <h2 className="detail-label">
              {t('news.version', { v: s.version })}
              {s.date && ` · ${date(`${s.date}T12:00:00Z`)}`}
            </h2>
            <ul className="news-list">
              {s.items.map((item) => (
                <li key={item}>{plain(item)}</li>
              ))}
            </ul>
          </motion.section>
        ))}
        <button className="button primary" onClick={onClose}>
          {t('news.ok')}
        </button>
      </div>
    </Sheet>
  );
}
