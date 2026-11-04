// Importar archivos elegidos por la persona (bienvenida y Ajustes → Organizar): reconoce cada formato
// por su nombre o contenido, nunca duplica, y deja completando portadas y datos en segundo plano.
import {
  importBooks,
  importJson,
  parseJsonBooks,
  parseMarkdown,
  type ImportedBook,
  type Library,
} from '../data';
import { parseCsvBooks } from '../data/import-csv';
import { restoreBackup } from '../sources/backup-zip';
import { enrichBooks } from './enrich';

export interface FilesImportResult {
  /** Libros nuevos (de notas, CSV o listas) más los que trajo un respaldo */
  added: number;
  /** Ya estaban en la biblioteca */
  skipped: number;
  /** EPUB y PDF recuperados de un respaldo completo */
  files: number;
}

export async function importFromFiles(
  lib: Library,
  files: File[],
  enrich = enrichBooks,
): Promise<FilesImportResult> {
  const items: ImportedBook[] = [];
  const result: FilesImportResult = { added: 0, skipped: 0, files: 0 };
  for (const f of files) {
    // Un respaldo completo (ZIP) se restaura entero, con su bóveda
    if (/\.zip$/i.test(f.name)) {
      const r = await restoreBackup(lib, f);
      result.added += r.added;
      result.files += r.filesRestored;
      continue;
    }
    const text = await f.text();
    if (/\.(csv|tsv)$/i.test(f.name)) {
      items.push(...parseCsvBooks(text));
    } else if (/\.json$/i.test(f.name) || /^\s*[[{]/.test(text)) {
      const data: unknown = JSON.parse(text);
      // Un respaldo de esta app se fusiona como respaldo (por id, gana lo más nuevo)
      if (data && typeof data === 'object' && 'format' in data) {
        result.added += (await importJson(lib, data)).added;
      } else items.push(...parseJsonBooks(data));
    } else items.push(...parseMarkdown(text, f.name));
  }
  if (items.length) {
    const r = await importBooks(lib, items);
    result.added += r.added.length;
    result.skipped += r.skipped;
    // Portadas, autores y años, de a poco y sin bloquear
    enrich(lib, r.added);
  }
  return result;
}

export const IMPORT_ACCEPT =
  '.md,.markdown,.txt,.json,.csv,.zip,text/markdown,text/plain,text/csv,application/json,application/zip';
