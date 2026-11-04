// Bienvenida: aparece la primera vez que se abre la app. Cuatro pasos que se pueden saltar:
// qué es Bookloft, cómo agregar libros, traer tu biblioteca (importar) y dejarla a tu gusto.
import {
  ArrowRight,
  Camera,
  Check,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  ScanBarcode,
  Search,
  Share2,
  Sparkles,
} from 'lucide-react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { useRef, useState } from 'react';
import { useLibrary } from '../app/library';
import { importFromFiles, type FilesImportResult } from '../app/import-files';
import { useBack } from '../app/native';
import { useI18n } from '../i18n';
import { fade, spring } from '../ui/motion';
import { AiSettings } from './AiSettings';
import { Segmented } from './Controls';
import { PalettePicker, type PaletteControl } from './PalettePicker';
import type { LangSetting, ThemeSetting } from './Settings';

export type WelcomeExit = 'library' | 'add' | 'discover';
const STEPS = 4;

export function Welcome({
  initialStep = 0,
  theme,
  setTheme,
  lang,
  setLang,
  palette,
  onFinish,
}: {
  initialStep?: number;
  theme: ThemeSetting;
  setTheme: (t: ThemeSetting) => void;
  lang: LangSetting;
  setLang: (l: LangSetting) => void;
  palette: PaletteControl;
  onFinish: (exit: WelcomeExit) => void;
}) {
  const { t } = useI18n();
  const [[step, direction], setStep] = useState<[number, number]>([initialStep, 0]);
  const [imported, setImported] = useState<FilesImportResult | null>(null);
  const go = (next: number) => {
    if (next < 0 || next >= STEPS) return;
    setStep([next, next > step ? 1 : -1]);
  };
  // Atrás vuelve al paso anterior; en el primero no hace nada (la bienvenida no se cierra sola)
  useBack(true, () => go(step - 1));

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -450) go(step + 1);
    else if (info.offset.x > 70 || info.velocity.x > 450) go(step - 1);
  };

  const last = step === STEPS - 1;

  return (
    <motion.div
      className="welcome"
      role="dialog"
      aria-modal="true"
      aria-label={t('welcome.title')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <header className="welcome-top">
        <div className="welcome-dots" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <motion.span
              key={i}
              className={i === step ? 'on' : ''}
              animate={{ width: i === step ? 22 : 7 }}
              transition={spring.snappy}
            />
          ))}
        </div>
        {!last && (
          <button
            className="button quiet welcome-skip"
            onClick={() => onFinish(imported ? 'library' : 'add')}
          >
            {t('welcome.skip')}
          </button>
        )}
      </header>

      <div className="welcome-stage">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={step}
            className="welcome-step"
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -40, transition: { duration: 0.15 } }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.sheet}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
          >
            {step === 0 && <Intro />}
            {step === 1 && <HowToAdd />}
            {step === 2 && <BringLibrary imported={imported} onImported={setImported} />}
            {step === 3 && (
              <MakeItYours
                theme={theme}
                setTheme={setTheme}
                lang={lang}
                setLang={setLang}
                palette={palette}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="welcome-bottom">
        {last ? (
          <>
            <button
              className="button primary"
              onClick={() => onFinish(imported?.added ? 'library' : 'add')}
            >
              {imported?.added ? t('welcome.seeLibrary') : t('welcome.addFirst')}
            </button>
            {!imported?.added && (
              <button className="button quiet" onClick={() => onFinish('discover')}>
                {t('welcome.explore')}
              </button>
            )}
          </>
        ) : (
          <button className="button primary" onClick={() => go(step + 1)}>
            {step === 0 ? t('welcome.start') : t('welcome.next')}
            <ArrowRight size={18} strokeWidth={1.8} aria-hidden />
          </button>
        )}
      </footer>
    </motion.div>
  );
}

// ---------- 1 · Qué es ----------

/** Los libros del ícono, cayendo uno a uno sobre la repisa */
function ShelfArt() {
  const book = (i: number, children: React.ReactNode, rotate?: string) => (
    <motion.g
      key={i}
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24, delay: 0.15 + i * 0.09 }}
    >
      <g transform={rotate}>{children}</g>
    </motion.g>
  );
  return (
    <svg className="welcome-art" viewBox="28 30 52 48" aria-hidden>
      {book(
        0,
        <>
          <rect x="34" y="42" width="7" height="26" rx="0.6" fill="#C8644B" />
          <rect x="38.2" y="42" width="2.8" height="26" fill="#000" opacity="0.1" />
          <rect x="35.4" y="45.2" width="4.2" height="0.9" rx="0.45" fill="#F2B49A" />
          <rect x="35.4" y="47.2" width="4.2" height="0.9" rx="0.45" fill="#F2B49A" />
        </>,
      )}
      {book(
        1,
        <>
          <rect x="41.5" y="35" width="6.5" height="33" rx="0.6" fill="#D9A441" />
          <rect x="45.4" y="35" width="2.6" height="33" fill="#000" opacity="0.08" />
          <rect x="41.5" y="38.4" width="6.5" height="1" fill="#A97A24" />
        </>,
      )}
      {book(
        2,
        <>
          <rect x="48.5" y="40" width="6.5" height="28" rx="0.6" fill="#8EA98A" />
          <rect x="52.6" y="40" width="2.4" height="28" fill="#000" opacity="0.08" />
          <rect x="50.4" y="45" width="2.8" height="6" rx="0.4" fill="#EFE6CE" />
        </>,
      )}
      {book(
        3,
        <>
          <rect x="55.5" y="36" width="4" height="32" rx="0.5" fill="#A59B6C" />
          <rect x="57.9" y="36" width="1.6" height="32" fill="#000" opacity="0.1" />
        </>,
      )}
      {book(
        4,
        <>
          <rect x="61" y="37" width="6.5" height="31" rx="0.6" fill="#E9DDC2" />
          <rect x="65.2" y="37" width="2.3" height="31" fill="#000" opacity="0.07" />
          <rect x="61" y="40.4" width="6.5" height="0.8" fill="#B8A57E" />
          <rect x="61" y="62.8" width="6.5" height="0.8" fill="#B8A57E" />
        </>,
        'rotate(20 67.5 68)',
      )}
      <rect x="31" y="68" width="46" height="1.6" rx="0.8" fill="var(--line)" />
      <motion.path
        d="M55.9 69.6 H59.1 V75 L57.5 73.6 L55.9 75 Z"
        fill="var(--accent)"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        style={{ originY: 0 }}
        transition={{ ...spring.sheet, delay: 0.7 }}
      />
    </svg>
  );
}

function Intro() {
  const { t } = useI18n();
  return (
    <div className="welcome-content intro">
      <ShelfArt />
      <h1 className="welcome-title">Bookloft</h1>
      <p className="welcome-lead">{t('welcome.lead')}</p>
      <ul className="welcome-points">
        {(['welcome.point1', 'welcome.point2', 'welcome.point3'] as const).map((k, i) => (
          <motion.li
            key={k}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.sheet, delay: 0.5 + i * 0.08 }}
          >
            <Check size={16} strokeWidth={2.2} aria-hidden />
            {t(k)}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 2 · Cómo agregar libros ----------

function HowToAdd() {
  const { t } = useI18n();
  const [ai, setAi] = useState(false);
  const ways = [
    [Search, 'welcome.waySearch'],
    [ScanBarcode, 'welcome.wayScan'],
    [Camera, 'welcome.wayPhoto'],
    [Share2, 'welcome.wayShare'],
  ] as const;
  return (
    <div className="welcome-content">
      <h1 className="welcome-heading">{t('welcome.addTitle')}</h1>
      <ul className="welcome-ways">
        {ways.map(([Icon, key], i) => (
          <motion.li
            key={key}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.sheet, delay: 0.05 + i * 0.06 }}
          >
            <span className="welcome-icon">
              <Icon size={20} strokeWidth={1.6} aria-hidden />
            </span>
            <span>
              <strong>{t(`${key}`)}</strong>
              <small>{t(`${key}Hint`)}</small>
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="welcome-ai">
        <Sparkles size={18} strokeWidth={1.6} aria-hidden />
        <p>{t('welcome.aiNote')}</p>
      </div>
      <AnimatePresence initial={false}>
        {ai ? (
          <motion.div
            key="ai"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={fade}
          >
            <AiSettings startEditing />
          </motion.div>
        ) : (
          <button className="button quiet welcome-ai-connect" onClick={() => setAi(true)}>
            {t('welcome.aiConnect')}
          </button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- 3 · Traer tu biblioteca ----------

type Source = 'csv' | 'notes' | 'backup';

function BringLibrary({
  imported,
  onImported,
}: {
  imported: FilesImportResult | null;
  onImported: (r: FilesImportResult) => void;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const [busy, setBusy] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<Source, HTMLInputElement | null>>>({});

  async function onFiles(source: Source, files: File[]) {
    if (!files.length) return;
    setBusy(source);
    setError(null);
    try {
      const r = await importFromFiles(lib, files);
      if (!r.added && !r.skipped) setError(t('tools.nothingFound'));
      else
        onImported({
          added: (imported?.added ?? 0) + r.added,
          skipped: (imported?.skipped ?? 0) + r.skipped,
          files: (imported?.files ?? 0) + r.files,
        });
    } catch (e) {
      console.error(e);
      setError(t('tools.importFailed'));
    } finally {
      setBusy(null);
    }
  }

  const cards: { id: Source; icon: typeof FileText; accept: string; multiple?: boolean }[] = [
    { id: 'csv', icon: FileSpreadsheet, accept: '.csv,text/csv,text/comma-separated-values' },
    {
      id: 'notes',
      icon: FileText,
      accept: '.md,.markdown,.txt,text/markdown,text/plain',
      multiple: true,
    },
    { id: 'backup', icon: FolderArchive, accept: '.zip,.json,application/zip,application/json' },
  ];

  return (
    <div className="welcome-content">
      <h1 className="welcome-heading">{t('welcome.importTitle')}</h1>
      <p className="welcome-sub">{t('welcome.importLead')}</p>
      <div className="welcome-cards">
        {cards.map(({ id, icon: Icon, accept, multiple }) => (
          <button
            key={id}
            className="welcome-card"
            disabled={!!busy}
            onClick={() => inputs.current[id]?.click()}
          >
            <span className="welcome-icon">
              <Icon size={20} strokeWidth={1.6} aria-hidden />
            </span>
            <span className="welcome-card-text">
              <strong>{t(`welcome.src.${id}`)}</strong>
              <small>{busy === id ? t('tools.importing') : t(`welcome.src.${id}Hint`)}</small>
            </span>
            <input
              ref={(el) => void (inputs.current[id] = el)}
              type="file"
              accept={accept}
              multiple={multiple}
              hidden
              onChange={(e) => {
                const list = [...(e.target.files ?? [])];
                e.target.value = '';
                void onFiles(id, list);
              }}
            />
          </button>
        ))}
      </div>
      <AnimatePresence>
        {imported && (
          <motion.div
            className="welcome-done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.sheet}
          >
            <Check size={18} strokeWidth={2.2} aria-hidden />
            <span>
              {t('welcome.imported', { added: imported.added, skipped: imported.skipped })}
              <small>{t('welcome.importedHint')}</small>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="inbox-error">{error}</p>}
      {!imported && <p className="hint">{t('welcome.fromScratch')}</p>}
    </div>
  );
}

// ---------- 4 · A tu gusto ----------

function MakeItYours({
  theme,
  setTheme,
  lang,
  setLang,
  palette,
}: {
  theme: ThemeSetting;
  setTheme: (t: ThemeSetting) => void;
  lang: LangSetting;
  setLang: (l: LangSetting) => void;
  palette: PaletteControl;
}) {
  const { t } = useI18n();
  return (
    <div className="welcome-content settings">
      <h1 className="welcome-heading">{t('welcome.yoursTitle')}</h1>
      <section>
        <h2 className="detail-label">{t('settings.language')}</h2>
        <Segmented
          label={t('settings.language')}
          value={lang}
          options={[
            { value: 'auto', label: t('lang.auto') },
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ]}
          onChange={setLang}
        />
      </section>
      <section>
        <h2 className="detail-label">{t('settings.theme')}</h2>
        <Segmented
          label={t('settings.theme')}
          value={theme}
          options={(['auto', 'light', 'dark'] as const).map((v) => ({
            value: v,
            label: t(`theme.${v}`),
          }))}
          onChange={setTheme}
        />
      </section>
      <PalettePicker {...palette} />
      <p className="hint">{t('welcome.changeLater')}</p>
    </div>
  );
}
