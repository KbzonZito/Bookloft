// Tipos de la biblioteca local

// 'wishlist' existió hasta la v0.7; la migración 0004 los pasó a 'to_read'
export const STATUSES = ['to_read', 'reading', 'read', 'abandoned'] as const;
export type Status = (typeof STATUSES)[number];

export interface Book {
  id: string;
  title: string;
  authors: string[];
  series: string | null;
  series_index: number | null;
  isbn: string | null;
  ol_key: string | null;
  cover_url: string | null;
  cover_path: string | null;
  year: number | null;
  pages: number | null;
  /** Reseña breve. null: no se ha buscado; '': se buscó y no hay */
  description: string | null;
  /** Orden en Próximos (dentro de Leyendo); null = no está en la lista */
  up_next: number | null;
  /** Página en que voy */
  current_page: number | null;
  /** Datos de Open Library para la pestaña Información */
  info: BookInfo | null;
  status: Status;
  priority: number; // 0 normal, 1 alta, 2 imprescindible
  position: number | null;
  tags: string[];
  note: string | null;
  rating: number | null; // 0.5 a 5, de a medias estrellas
  source_url: string | null;
  added_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface BookInfo {
  subjects?: string[];
  ratings_average?: number;
  ratings_count?: number;
  publishers?: string[];
  first_publish_year?: number;
  editions?: number;
  languages?: string[];
}

/** Lo que el usuario puede cambiar de un libro */
export type BookPatch = Partial<
  Omit<Book, 'id' | 'added_at' | 'updated_at' | 'deleted_at' | 'position'>
>;

// Resultado de búsqueda (Open Library, IA, ISBN), todavía no guardado
export interface Candidate {
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  ol_key: string | null;
  isbn: string | null;
  pages: number | null;
  series?: string | null;
  series_index?: number | null;
}

export interface VaultFile {
  id: string;
  book_id: string | null;
  path: string;
  filename: string;
  size: number;
  sha256: string;
  format: string;
  meta_title: string | null;
  meta_author: string | null;
  added_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InboxKind = 'text' | 'url' | 'image';
export type InboxState = 'pending' | 'done' | 'dismissed';

export type IdentifyMethod = 'isbn' | 'ai' | 'ocr' | 'search' | 'none';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  input: string | null;
  image_path: string | null;
  candidates: Candidate[];
  state: InboxState;
  book_id: string | null;
  created_at: string;
  updated_at: string;
  /** null mientras no se ha identificado */
  method: IdentifyMethod | null;
  queries: string[];
  identified_at: string | null;
  error: string | null;
}
