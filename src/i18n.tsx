// Textos en español e inglés. Cada clave existe en ambos; {n} se reemplaza con t(key, { n }).
import { createContext, useContext, type ReactNode } from 'react';
import type { Status } from './data';

export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const es = {
  'shelf.reading': 'Leyendo',
  'shelf.to_read': 'Por leer',
  'shelf.wishlist': 'Deseos',
  'shelf.read': 'Leídos',
  'shelf.abandoned': 'Abandonados',
  'status.reading': 'Leyendo',
  'status.to_read': 'Por leer',
  'status.wishlist': 'Lo quiero',
  'status.read': 'Leído',
  'status.abandoned': 'Abandonado',

  'app.name': 'Biblioteca',
  'app.shelves': 'Estantes',
  'app.search': 'Buscar en toda la biblioteca',
  'app.closeSearch': 'Cerrar búsqueda',
  'app.add': 'Agregar libro',
  'app.settings': 'Ajustes',
  'app.loading': 'Abriendo la biblioteca…',
  'app.dbError': 'No se pudo abrir la base de datos: {msg}',
  'app.books': '{n} libros',
  'app.book': '1 libro',
  'app.results': '{n} resultados',
  'app.noResults': 'Nada coincide con «{q}». Prueba con el autor o la saga.',

  'view.covers': 'Portadas',
  'view.authors': 'Autores',
  'sort.label': 'Ordenar',
  'sort.mine': 'Mi orden',
  'sort.recent': 'Recientes',
  'sort.title': 'Título',
  'sort.author': 'Autor',

  'empty.reading': 'No estás leyendo nada. Abre un libro de «Por leer» y márcalo como «Leyendo».',
  'empty.to_read': 'Tu pila está vacía. Agrega el próximo libro que quieras leer.',
  'empty.wishlist': 'Guarda aquí los libros que todavía no tienes.',
  'empty.read': 'Los libros que termines aparecerán aquí.',
  'empty.abandoned': 'Ningún libro abandonado. Bien.',
  'empty.library': 'Tu biblioteca está vacía.',
  'empty.addFirst': 'Agregar mi primer libro',
  'empty.sample': 'Cargar biblioteca de ejemplo',

  'book.close': 'Cerrar',
  'book.by': 'de {authors}',
  'book.series': 'Libro {n} de {series}',
  'book.seriesNoIndex': 'Saga {series}',
  'book.status': 'Estado',
  'book.rating': 'Calificación',
  'book.ratingValue': '{n} de 5',
  'book.priority': 'Prioridad',
  'priority.0': 'Normal',
  'priority.1': 'Alta',
  'priority.2': 'Imprescindible',
  'book.tags': 'Etiquetas',
  'book.addTag': 'Nueva etiqueta',
  'book.removeTag': 'Quitar {tag}',
  'book.note': 'Nota',
  'book.notePlaceholder': 'Lo que quieras recordar de este libro',
  'book.added': 'Agregado',
  'book.started': 'Empezado',
  'book.finished': 'Terminado',
  'book.pages': '{n} páginas',
  'book.delete': 'Quitar de la biblioteca',
  'book.deleted': '«{title}» quitado',
  'book.undo': 'Deshacer',

  'add.title': 'Agregar libro',
  'add.bookTitle': 'Título',
  'add.author': 'Autor',
  'add.shelf': 'Estante',
  'add.save': 'Agregar',
  'add.added': '«{title}» agregado a {shelf}',
  'add.duplicate': '«{title}» ya estaba en tu biblioteca',
  'add.searchPlaceholder': 'Título, autor, ISBN o link',
  'add.scan': 'Escanear ISBN',
  'add.fromImage': 'Desde una imagen',
  'add.hint': 'Busca en Open Library, o pega el texto o el link de un post.',
  'add.searching': 'Buscando…',
  'add.offline': 'No se pudo buscar. Revisa tu conexión.',
  'add.noResults': 'Open Library no encontró «{q}».',
  'add.manual': 'Escribirlo a mano',
  'add.inLibrary': 'Ya está en tu biblioteca',
  'add.addThis': 'Agregar «{title}»',
  'add.scannerInstalling': 'Descargando el lector de códigos (solo la primera vez)…',

  'inbox.title': 'Bandeja',
  'inbox.open': 'Abrir la bandeja ({n})',
  'inbox.addTo': 'Agregar a',
  'inbox.empty':
    'Nada por revisar. Desde Instagram, comparte un post, un link o un pantallazo a la app.',
  'inbox.identifying': 'Buscando el libro…',
  'inbox.byIsbn': 'Encontrado por ISBN',
  'inbox.byAi': 'Leído con IA',
  'inbox.byOcr': 'Leído en el teléfono',
  'inbox.bySearch': 'Buscado por el texto',
  'inbox.none': 'No se encontró un libro claro. Búscalo abajo.',
  'inbox.refine': 'Buscar otro título',
  'inbox.retry': 'Volver a intentar',
  'inbox.done': 'Listo',
  'inbox.dismiss': 'Descartar',

  'ai.title': 'Leer pantallazos con IA',
  'ai.explain':
    'Sin IA, la app lee el texto de la imagen en tu teléfono y lo busca en Open Library. Con tu propia API key de Claude reconoce portadas y textos largos mucho mejor.',
  'ai.connect': 'Conectar mi API key',
  'ai.connected': 'Conectada ({key})',
  'ai.disconnect': 'Desconectar',
  'ai.step1': 'Crea una cuenta y una API key en',
  'ai.step2': 'Carga saldo: con 5 USD alcanza para miles de pantallazos.',
  'ai.step3':
    'Pega la key aquí. Se guarda cifrada en este dispositivo y solo se envía a Anthropic.',
  'ai.keyLabel': 'API key de Anthropic',
  'ai.cost': 'Cuesta unos 0,03 USD cada 100 pantallazos (Claude Haiku 5.5).',
  'ai.save': 'Probar y guardar',
  'ai.testing': 'Probando…',
  'ai.review': 'Revisar la IA',
  'ai.error.invalid_key': 'La API key no es válida.',
  'ai.error.no_credit': 'La cuenta de Anthropic no tiene saldo.',
  'ai.error.rate_limited': 'Demasiadas solicitudes. Intenta en un minuto.',
  'ai.error.network': 'No se pudo conectar con Anthropic.',
  'ai.error.other': 'La IA no pudo leerlo.',

  'settings.title': 'Ajustes',
  'settings.theme': 'Apariencia',
  'theme.auto': 'Automática',
  'theme.light': 'Día',
  'theme.dark': 'Noche',
  'settings.language': 'Idioma',
  'lang.auto': 'Del sistema',
  'settings.backup': 'Respaldo',
  'settings.export': 'Exportar biblioteca',
  'settings.import': 'Importar respaldo',
  'settings.imported': '{added} nuevos, {updated} actualizados, {invalid} con errores',
  'settings.importFailed': 'No se pudo importar: {msg}',
  'settings.exportNative': 'Exportar desde el teléfono llega con los respaldos (Fase 5).',
  'settings.dev': 'Desarrollo',
  'settings.version': 'Versión {v}',
} as const;

export type MessageKey = keyof typeof es;

const en: Record<MessageKey, string> = {
  'shelf.reading': 'Reading',
  'shelf.to_read': 'To read',
  'shelf.wishlist': 'Wishlist',
  'shelf.read': 'Read',
  'shelf.abandoned': 'Abandoned',
  'status.reading': 'Reading',
  'status.to_read': 'To read',
  'status.wishlist': 'Want it',
  'status.read': 'Read',
  'status.abandoned': 'Abandoned',

  'app.name': 'Library',
  'app.shelves': 'Shelves',
  'app.search': 'Search your whole library',
  'app.closeSearch': 'Close search',
  'app.add': 'Add book',
  'app.settings': 'Settings',
  'app.loading': 'Opening the library…',
  'app.dbError': 'Could not open the database: {msg}',
  'app.books': '{n} books',
  'app.book': '1 book',
  'app.results': '{n} results',
  'app.noResults': 'Nothing matches “{q}”. Try the author or the series.',

  'view.covers': 'Covers',
  'view.authors': 'Authors',
  'sort.label': 'Sort',
  'sort.mine': 'My order',
  'sort.recent': 'Recent',
  'sort.title': 'Title',
  'sort.author': 'Author',

  'empty.reading':
    'You are not reading anything. Open a book from “To read” and mark it as “Reading”.',
  'empty.to_read': 'Your pile is empty. Add the next book you want to read.',
  'empty.wishlist': 'Keep the books you don’t own yet here.',
  'empty.read': 'Books you finish will show up here.',
  'empty.abandoned': 'No abandoned books. Good.',
  'empty.library': 'Your library is empty.',
  'empty.addFirst': 'Add my first book',
  'empty.sample': 'Load a sample library',

  'book.close': 'Close',
  'book.by': 'by {authors}',
  'book.series': 'Book {n} of {series}',
  'book.seriesNoIndex': '{series} series',
  'book.status': 'Status',
  'book.rating': 'Rating',
  'book.ratingValue': '{n} out of 5',
  'book.priority': 'Priority',
  'priority.0': 'Normal',
  'priority.1': 'High',
  'priority.2': 'Must read',
  'book.tags': 'Tags',
  'book.addTag': 'New tag',
  'book.removeTag': 'Remove {tag}',
  'book.note': 'Note',
  'book.notePlaceholder': 'Anything you want to remember about this book',
  'book.added': 'Added',
  'book.started': 'Started',
  'book.finished': 'Finished',
  'book.pages': '{n} pages',
  'book.delete': 'Remove from library',
  'book.deleted': '“{title}” removed',
  'book.undo': 'Undo',

  'add.title': 'Add book',
  'add.bookTitle': 'Title',
  'add.author': 'Author',
  'add.shelf': 'Shelf',
  'add.save': 'Add',
  'add.added': '“{title}” added to {shelf}',
  'add.duplicate': '“{title}” was already in your library',
  'add.searchPlaceholder': 'Title, author, ISBN or link',
  'add.scan': 'Scan ISBN',
  'add.fromImage': 'From an image',
  'add.hint': 'Search Open Library, or paste the text or link of a post.',
  'add.searching': 'Searching…',
  'add.offline': 'Could not search. Check your connection.',
  'add.noResults': 'Open Library found nothing for “{q}”.',
  'add.manual': 'Type it in',
  'add.inLibrary': 'Already in your library',
  'add.addThis': 'Add “{title}”',
  'add.scannerInstalling': 'Downloading the code scanner (first time only)…',

  'inbox.title': 'Inbox',
  'inbox.open': 'Open the inbox ({n})',
  'inbox.addTo': 'Add to',
  'inbox.empty':
    'Nothing to review. From Instagram, share a post, a link or a screenshot to the app.',
  'inbox.identifying': 'Looking for the book…',
  'inbox.byIsbn': 'Found by ISBN',
  'inbox.byAi': 'Read with AI',
  'inbox.byOcr': 'Read on the phone',
  'inbox.bySearch': 'Searched by the text',
  'inbox.none': 'No clear book found. Search for it below.',
  'inbox.refine': 'Search another title',
  'inbox.retry': 'Try again',
  'inbox.done': 'Done',
  'inbox.dismiss': 'Dismiss',

  'ai.title': 'Read screenshots with AI',
  'ai.explain':
    'Without AI, the app reads the text in the image on your phone and searches Open Library. With your own Claude API key it recognizes covers and long texts much better.',
  'ai.connect': 'Connect my API key',
  'ai.connected': 'Connected ({key})',
  'ai.disconnect': 'Disconnect',
  'ai.step1': 'Create an account and an API key at',
  'ai.step2': 'Add credit: 5 USD covers thousands of screenshots.',
  'ai.step3':
    'Paste the key here. It is stored encrypted on this device and only sent to Anthropic.',
  'ai.keyLabel': 'Anthropic API key',
  'ai.cost': 'About 0.03 USD per 100 screenshots (Claude Haiku 5.5).',
  'ai.save': 'Test and save',
  'ai.testing': 'Testing…',
  'ai.review': 'Check the AI',
  'ai.error.invalid_key': 'The API key is not valid.',
  'ai.error.no_credit': 'The Anthropic account has no credit.',
  'ai.error.rate_limited': 'Too many requests. Try again in a minute.',
  'ai.error.network': 'Could not reach Anthropic.',
  'ai.error.other': 'The AI could not read it.',

  'settings.title': 'Settings',
  'settings.theme': 'Appearance',
  'theme.auto': 'Automatic',
  'theme.light': 'Day',
  'theme.dark': 'Night',
  'settings.language': 'Language',
  'lang.auto': 'System',
  'settings.backup': 'Backup',
  'settings.export': 'Export library',
  'settings.import': 'Import backup',
  'settings.imported': '{added} new, {updated} updated, {invalid} with errors',
  'settings.importFailed': 'Could not import: {msg}',
  'settings.exportNative': 'Exporting from the phone comes with backups (phase 5).',
  'settings.dev': 'Development',
  'settings.version': 'Version {v}',
};

const DICTS: Record<Lang, Record<MessageKey, string>> = { es, en };

export const systemLang = (): Lang =>
  navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: MessageKey, vars?: Vars) {
  let text = DICTS[lang][key];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

interface I18n {
  lang: Lang;
  t: (key: MessageKey, vars?: Vars) => string;
  shelf: (s: Status) => string;
  status: (s: Status) => string;
  date: (iso: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const fmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' });
  const value: I18n = {
    lang,
    t: (key, vars) => translate(lang, key, vars),
    shelf: (s) => translate(lang, `shelf.${s}`),
    status: (s) => translate(lang, `status.${s}`),
    date: (iso) => fmt.format(new Date(iso)),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n fuera de I18nProvider');
  return ctx;
}
