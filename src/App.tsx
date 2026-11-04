import {
  Archive,
  ArrowDownUp,
  CalendarHeart,
  Check,
  Inbox as InboxIcon,
  LayoutGrid,
  LibraryBig,
  Plus,
  Rows3,
  Search,
  Settings2,
  Store,
  X,
} from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, MotionConfig, type PanInfo } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAllBooks, useLibrary, useSetting } from './app/library';
import { useWindowSize } from './app/layout';
import { haptic, setHapticsEnabled, setSystemBars, useBack } from './app/native';
import {
  searchBooks,
  shelfFor,
  SHELVES,
  sortBooks,
  SORTS,
  STATUS_ORDER,
  type ShelfId,
  type Sort,
} from './app/shelves';
import { onShare, usePendingInbox } from './app/inbox';
import { AddBook } from './components/AddBook';
import { NextRead } from './components/NextRead';
import { UpNext } from './components/UpNext';
import { Discover } from './components/Discover';
import { QuickActions } from './components/QuickActions';
import { YearReview } from './components/YearReview';
import { WhatsNew } from './components/WhatsNew';
import { changesSince, type ChangelogSection } from './app/whats-new';
import changelog from '../CHANGELOG.md?raw';
import { AuthorList } from './components/AuthorList';
import { BookPanel, BookSheet } from './components/BookDetail';
import { ReadingContext, seriesProgress } from './app/reading';
import { BookGrid } from './components/BookGrid';
import { Inbox } from './components/Inbox';
import { NavBar } from './components/NavBar';
import { Vault } from './components/Vault';
import { Settings, type LangSetting, type ThemeSetting } from './components/Settings';
import { ShelfTabs } from './components/ShelfTabs';
import { Toast, type ToastMessage } from './components/Toast';
import { importBooks, parseMarkdown, type Book, type Status } from './data';
import { I18nProvider, systemLang, useI18n } from './i18n';
import { daysSinceBackup } from './sources/backup-zip';
import { fade, spring } from './ui/motion';
import { applyPalette, paintWindow, useSystemPalette, type PaletteId } from './app/palette';
import type { PaletteControl } from './components/PalettePicker';

type View = 'covers' | 'authors';
type Tab = 'library' | 'discover' | 'search' | 'vault' | 'settings';

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function useTheme(setting: ThemeSetting, palette: PaletteId) {
  const [systemDark, setSystemDark] = useState(darkQuery.matches);
  useEffect(() => {
    const on = () => setSystemDark(darkQuery.matches);
    darkQuery.addEventListener('change', on);
    return () => darkQuery.removeEventListener('change', on);
  }, []);
  const system = useSystemPalette();
  const dark = setting === 'dark' || (setting === 'auto' && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    applyPalette(palette, dark, system);
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', paper);
    void setSystemBars(dark).then(() => paintWindow(paper));
  }, [dark, palette, system]);
  return { dark, system };
}

export function App() {
  const [theme, setTheme] = useSetting<ThemeSetting>('theme', 'auto');
  const [lang, setLang] = useSetting<LangSetting>('language', 'auto');
  const [palette, setPalette] = useSetting<PaletteId>('palette', 'library');
  const [haptics] = useSetting('haptics', true);
  useEffect(() => setHapticsEnabled(haptics), [haptics]);
  const { dark, system } = useTheme(theme, palette);
  return (
    <I18nProvider lang={lang === 'auto' ? systemLang() : lang}>
      <MotionConfig reducedMotion="user">
        <Shell
          theme={theme}
          setTheme={setTheme}
          lang={lang}
          setLang={setLang}
          palette={{ value: palette, set: setPalette, dark, system }}
        />
      </MotionConfig>
    </I18nProvider>
  );
}

// Los leídos y abandonados se miran por fecha; las pilas, en el orden que uno decide
const defaultSort = (s: ShelfId): Sort => (s === 'read' || s === 'abandoned' ? 'recent' : 'mine');

function Shell({
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
  const lib = useLibrary();
  const { t, status: statusLabel } = useI18n();
  const books = useAllBooks();
  const size = useWindowSize();

  const [shelf, setShelf] = useState<ShelfId>('shelf');
  // Filtro de la Estantería (que muestra todos los libros)
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [direction, setDirection] = useState(0);
  const [view, setView] = useState<View>('covers');
  const [sorts, setSorts] = useState<Partial<Record<ShelfId, Sort>>>({});
  const [tab, setTab] = useState<Tab>('library');
  const [query, setQuery] = useState('');
  const [nextOpen, setNextOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [quickId, setQuickId] = useState<string | null>(null);
  const [news, setNews] = useState<ChangelogSection[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // La última portada abierta: la única con layoutId en la cuadrícula
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Ajustes abiertos desde un error de la IA: directo a conectar la API key
  const [aiFocus, setAiFocus] = useState(false);
  const [inbox, setInbox] = useState(false);
  const pending = usePendingInbox();

  const [toast, setToastState] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((text: string, action?: ToastMessage['action']) => {
    clearTimeout(toastTimer.current);
    setToastState({ id: Date.now(), text, action });
    toastTimer.current = setTimeout(() => setToastState(null), action ? 5000 : 3000);
  }, []);

  // Lo que se comparte desde otra app abre la bandeja (posts) o la bóveda (EPUB, PDF).
  // Se escucha una sola vez; el texto del aviso usa el idioma vigente a través de la ref.
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(
    () =>
      onShare((outcome) => {
        setOpenId(null);
        setAdding(false);
        if (outcome.to === 'inbox') return setInbox(true);
        setTab('vault');
        showToast(
          outcome.files
            .map((f) =>
              tRef.current(f.duplicate ? 'vault.alreadyThere' : 'vault.received', { name: f.name }),
            )
            .join('. '),
        );
      }),
    [showToast],
  );

  // Un recordatorio suave para respaldar: con 10 libros o más, si pasó un mes, una vez por semana.
  // Solo al abrir la app: si no, tapaba el aviso de una importación que pasaba de 10 libros.
  const reminded = useRef(false);
  useEffect(() => {
    if (!books || reminded.current) return;
    reminded.current = true;
    if (books.length < 10) return;
    void (async () => {
      const days = await daysSinceBackup(lib);
      const last = await lib.getSetting<string | null>('backup_reminded_at', null);
      const weekAgo = Date.now() - 7 * 86_400_000;
      if ((days === null || days > 30) && (!last || Date.parse(last) < weekAgo)) {
        await lib.setSetting('backup_reminded_at', new Date().toISOString());
        showToast(tRef.current('backup.remind'), {
          label: tRef.current('backup.remindAction'),
          run: () => setTab('settings'),
        });
      }
    })();
  }, [books]);

  // Novedades: una vez por versión. En una instalación nueva (sin libros) no hay nada que contar.
  const newsChecked = useRef(false);
  useEffect(() => {
    if (!books || newsChecked.current) return;
    newsChecked.current = true;
    void (async () => {
      const seen = await lib.getSetting<string | null>('last_seen_version', null);
      if (seen === __APP_VERSION__) return;
      const sections = books.length ? changesSince(changelog, seen, __APP_VERSION__) : [];
      if (sections.length) setNews(sections);
      else await lib.setSetting('last_seen_version', __APP_VERSION__);
    })();
  }, [books]);

  // Al abrir, el estante "Leyendo" si hay algo ahí
  const started = useRef(false);
  useEffect(() => {
    if (!books || started.current) return;
    started.current = true;
    if (books.some((b) => b.status === 'reading')) setShelf('reading');
  }, [books]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(SHELVES.map((s) => [s, 0])) as Record<ShelfId, number>;
    for (const b of books ?? []) {
      c.shelf++;
      if (b.status !== 'to_read') c[b.status]++;
    }
    return c;
  }, [books]);

  const sort = sorts[shelf] ?? defaultSort(shelf);
  const shown = useMemo(
    () =>
      sortBooks(
        (books ?? []).filter((b) =>
          shelf === 'shelf' ? filter === 'all' || b.status === filter : b.status === shelf,
        ),
        sort,
      ),
    [books, shelf, sort, filter],
  );
  const upNext = useMemo(
    () => (books ?? []).filter((b) => b.up_next != null).sort((a, b) => a.up_next! - b.up_next!),
    [books],
  );
  const found = useMemo(
    () => (books && query.trim() ? sortBooks(searchBooks(books, query), 'title') : []),
    [books, query],
  );

  const openBook = books?.find((b) => b.id === openId) ?? null;
  const quickBook = books?.find((b) => b.id === quickId) ?? null;
  const progress = useMemo(() => seriesProgress(books ?? []), [books]);
  // La portada recibe su layoutId al apoyar el dedo; Motion la mide mientras tanto y al soltar
  // ya puede volar a la ficha. Con teclado no hay "apoyar": se espera a que Motion mida.
  const activeRef = useRef<string | null>(null);
  const onPrepare = useCallback((b: Book) => {
    activeRef.current = b.id;
    setActiveId(b.id);
  }, []);
  const onOpen = useCallback(
    (b: Book) => {
      if (activeRef.current === b.id) return setOpenId(b.id);
      onPrepare(b);
      requestAnimationFrame(() => requestAnimationFrame(() => setOpenId(b.id)));
    },
    [onPrepare],
  );
  const close = useCallback(() => setOpenId(null), []);
  // Desde la ficha, abrir otro libro (el siguiente de la saga): cambia la ficha sin cerrarla
  const reading = useMemo(
    () => ({
      progress,
      openBook: (b: Book) => {
        activeRef.current = b.id;
        setActiveId(b.id);
        setOpenId(b.id);
      },
      quickActions: (b: Book) => setQuickId(b.id),
    }),
    [progress],
  );

  const goTo = (next: ShelfId) => {
    if (next === shelf) return;
    setDirection(SHELVES.indexOf(next) > SHELVES.indexOf(shelf) ? 1 : -1);
    setShelf(next);
    window.scrollTo({ top: 0 });
  };

  // Deslizar entre estantes en el teléfono
  const onSwipe = (_: unknown, info: PanInfo) => {
    const i = SHELVES.indexOf(shelf);
    const far = Math.abs(info.offset.x) > 70 || Math.abs(info.velocity.x) > 450;
    if (!far) return;
    const next = SHELVES[i + (info.offset.x < 0 ? 1 : -1)];
    if (next) {
      haptic.tick();
      goTo(next);
    }
  };

  const remove = async (b: Book) => {
    setOpenId(null);
    await lib.deleteBook(b.id);
    showToast(t('book.deleted', { title: b.title }), {
      label: t('book.undo'),
      run: () => void lib.restoreBook(b.id),
    });
  };

  // Solo en desarrollo: una biblioteca de ejemplo para probar (el import dinámico no llega al APK)
  const loadSample = import.meta.env.DEV
    ? async () => {
        const [{ SAMPLE_NOTES }, { enrichBooks }] = await Promise.all([
          import('./dev/sample'),
          import('./app/enrich'),
        ]);
        const r = await importBooks(lib, parseMarkdown(SAMPLE_NOTES, 'Ejemplo.md'));
        enrichBooks(lib, r.added);
        setTab('library');
        showToast(t('tools.imported', { added: r.added.length, skipped: r.skipped }));
      }
    : undefined;

  // Atrás en otra pestaña vuelve a la biblioteca
  useBack(tab !== 'library' && openId === null, () => setTab('library'));

  const go = (next: Tab) => {
    setAiFocus(false);
    if (next === tab && next === 'library') window.scrollTo({ top: 0, behavior: 'smooth' });
    setTab(next);
  };

  if (!books) return <div className="loading">{t('app.loading')}</div>;

  const expanded = size === 'expanded';
  const shelfBody =
    shown.length === 0 ? (
      <p className="empty-shelf">{t(`empty.${shelf}`)}</p>
    ) : view === 'authors' ? (
      <AuthorList
        books={shown}
        progress={progress}
        activeId={activeId}
        openId={openId}
        onPrepare={onPrepare}
        onOpen={onOpen}
      />
    ) : (
      <BookGrid
        books={shown}
        activeId={activeId}
        openId={openId}
        onPrepare={onPrepare}
        onOpen={onOpen}
      />
    );
  const libraryContent =
    books.length === 0 ? (
      <EmptyLibrary onAdd={() => setAdding(true)} onSample={loadSample} />
    ) : (
      <>
        {shelfBody}
        {shelf === 'reading' && (
          <UpNext
            books={upNext}
            onOpen={(b) => onOpen(b)}
            onSuggest={() => setNextOpen(true)}
            canSuggest={books.some((b) => b.status === 'to_read')}
          />
        )}
      </>
    );

  const screens: Record<Tab, ReactNode> = {
    discover: <Discover books={books} toast={showToast} />,
    library: (
      <>
        {pending.length > 0 && (
          <button className="inbox-banner" onClick={() => setInbox(true)}>
            <InboxIcon size={18} strokeWidth={1.6} aria-hidden />
            <span>{t('inbox.banner', { n: pending.length })}</span>
          </button>
        )}
        {shelf === 'shelf' && books.length > 0 && (
          <div className="filter-chips" role="radiogroup" aria-label={t('shelf.filter')}>
            {(['all', ...STATUS_ORDER] as const).map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={filter === f}
                className={`chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? t('shelf.all') : statusLabel(f)}
                <span className="chip-count">
                  {f === 'all' ? books.length : books.filter((b) => b.status === f).length}
                </span>
              </button>
            ))}
          </div>
        )}
        {shelf === 'read' && counts.read > 0 && (
          <button className="next-banner" onClick={() => setYearOpen(true)}>
            <CalendarHeart size={16} strokeWidth={1.6} aria-hidden />
            <span>{t('year.banner', { year: new Date().getFullYear() })}</span>
          </button>
        )}
        {books.length > 0 && (
          <Toolbar
            count={shown.length}
            view={view}
            setView={setView}
            sort={sort}
            setSort={(s) => setSorts((m) => ({ ...m, [shelf]: s }))}
          />
        )}
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={shelf}
            className="shelf-page"
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 28 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -28, transition: { duration: 0.12 } }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring.sheet}
            {...(!expanded && {
              drag: 'x' as const,
              dragDirectionLock: true,
              dragConstraints: { left: 0, right: 0 },
              dragElastic: 0.18,
              dragSnapToOrigin: true,
              onDragEnd: onSwipe,
            })}
          >
            {libraryContent}
          </motion.div>
        </AnimatePresence>
      </>
    ),
    search: (
      <>
        <SearchField query={query} setQuery={setQuery} />
        {!query.trim() ? (
          <p className="hint search-hint">{t('search.hint')}</p>
        ) : found.length === 0 ? (
          <p className="empty-shelf">{t('app.noResults', { q: query.trim() })}</p>
        ) : (
          <>
            <p className="toolbar-count search-count">{t('app.results', { n: found.length })}</p>
            <BookGrid
              books={found}
              activeId={activeId}
              openId={openId}
              showStatus
              onPrepare={onPrepare}
              onOpen={onOpen}
            />
          </>
        )}
      </>
    ),
    vault: <Vault toast={showToast} onOpenBook={onOpen} />,
    settings: (
      <Settings
        aiFocus={aiFocus}
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={setLang}
        palette={palette}
        toast={showToast}
        onLoadSample={loadSample}
      />
    ),
  };

  return (
    <ReadingContext.Provider value={reading}>
      <LayoutGroup>
        <div className={`app ${size} ${openBook && expanded ? 'with-detail' : ''}`}>
          <NavBar
            tabs={[
              { id: 'library', icon: LibraryBig, badge: pending.length },
              { id: 'discover', icon: Store },
              { id: 'vault', icon: Archive },
              { id: 'settings', icon: Settings2 },
              { id: 'search', icon: Search, featured: true },
            ]}
            active={tab}
            onSelect={go}
            label={(id) => t(`tab.${id}`)}
            onAdd={() => setAdding(true)}
            addLabel={t('app.add')}
          />

          <div className="screen">
            <header className="topbar">
              {tab === 'library' ? (
                <ShelfTabs active={shelf} counts={counts} onSelect={goTo} />
              ) : (
                <h1 className="screen-title">{t(`tab.${tab}`)}</h1>
              )}
            </header>
            <main className="main">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={spring.sheet}
                >
                  {screens[tab]}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

          <AnimatePresence>
            {openBook &&
              (expanded ? (
                <BookPanel
                  key={openBook.id}
                  book={openBook}
                  onClose={close}
                  onDelete={remove}
                  toast={showToast}
                />
              ) : (
                <BookSheet
                  key={openBook.id}
                  book={openBook}
                  onClose={close}
                  onDelete={remove}
                  toast={showToast}
                />
              ))}
          </AnimatePresence>

          <AnimatePresence>
            {quickBook && (
              <QuickActions
                book={quickBook}
                onClose={() => setQuickId(null)}
                onDelete={remove}
                toast={showToast}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {news && (
              <WhatsNew
                sections={news}
                onClose={() => {
                  setNews(null);
                  void lib.setSetting('last_seen_version', __APP_VERSION__);
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {yearOpen && (
              <YearReview
                books={books}
                onClose={() => setYearOpen(false)}
                onOpenBook={reading.openBook}
                toast={showToast}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {nextOpen && (
              <NextRead
                books={books}
                onClose={() => setNextOpen(false)}
                onOpenBook={reading.openBook}
                toast={showToast}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {adding && (
              <AddBook
                initialShelf={shelf === 'shelf' ? (filter === 'all' ? 'to_read' : filter) : shelf}
                onClose={() => setAdding(false)}
                toast={showToast}
                onToInbox={() => {
                  setAdding(false);
                  setInbox(true);
                }}
                onAdded={(message, addedTo) => {
                  setAdding(false);
                  showToast(message);
                  setTab('library');
                  goTo(shelfFor(addedTo));
                }}
              />
            )}
            {inbox && (
              <Inbox
                onClose={() => setInbox(false)}
                onOpenAi={() => {
                  setInbox(false);
                  setAiFocus(true);
                  setTab('settings');
                }}
              />
            )}
          </AnimatePresence>

          <Toast toast={toast} onDone={() => setToastState(null)} />
        </div>
      </LayoutGroup>
    </ReadingContext.Provider>
  );
}

function SearchField({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="search search-screen">
      <Search size={18} strokeWidth={1.5} aria-hidden />
      <input
        type="search"
        value={query}
        placeholder={t('app.search')}
        aria-label={t('app.search')}
        autoFocus
        enterKeyHint="search"
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <button
          className="icon-button small"
          onClick={() => setQuery('')}
          aria-label={t('app.closeSearch')}
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

function Toolbar({
  count,
  view,
  setView,
  sort,
  setSort,
}: {
  count: number;
  view: View;
  setView: (v: View) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
}) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  useBack(menu, () => setMenu(false));
  return (
    <div className="toolbar">
      <span className="toolbar-count">
        {count === 1 ? t('app.book') : t('app.books', { n: count })}
      </span>
      {
        <>
          <button
            className="icon-button"
            aria-label={view === 'covers' ? t('view.authors') : t('view.covers')}
            onClick={() => setView(view === 'covers' ? 'authors' : 'covers')}
          >
            {view === 'covers' ? (
              <Rows3 size={19} strokeWidth={1.5} />
            ) : (
              <LayoutGrid size={19} strokeWidth={1.5} />
            )}
          </button>
          <div className="menu-anchor">
            <button
              className="icon-button"
              aria-label={t('sort.label')}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <ArrowDownUp size={19} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {menu && (
                <>
                  <button
                    className="menu-dismiss"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => setMenu(false)}
                  />
                  <motion.ul
                    className="menu"
                    role="menu"
                    initial={{ opacity: 0, scale: 0.94, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, transition: fade }}
                    transition={spring.snappy}
                    style={{ originX: 1, originY: 0 }}
                  >
                    {SORTS.map((s) => (
                      <li key={s}>
                        <button
                          role="menuitemradio"
                          aria-checked={s === sort}
                          onClick={() => {
                            setSort(s);
                            setMenu(false);
                          }}
                        >
                          {t(`sort.${s}`)}
                          {s === sort && <Check size={16} strokeWidth={2} aria-hidden />}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                </>
              )}
            </AnimatePresence>
          </div>
        </>
      }
    </div>
  );
}

function EmptyLibrary({ onAdd, onSample }: { onAdd: () => void; onSample?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="empty-library">
      <p className="empty-title">{t('empty.library')}</p>
      <button className="button primary" onClick={onAdd}>
        <Plus size={18} strokeWidth={2} aria-hidden />
        {t('empty.addFirst')}
      </button>
      {onSample && (
        <button className="button quiet" onClick={onSample}>
          {t('empty.sample')}
        </button>
      )}
    </div>
  );
}
