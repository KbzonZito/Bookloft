// Organizar la biblioteca: importar notas o listas, completar datos y portadas, ordenar en sagas con IA
import { FileDown, FileUp, Library as LibraryIcon, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { enrichBooks, needsData, useEnrichProgress } from '../app/enrich';
import { IMPORT_ACCEPT, importFromFiles } from '../app/import-files';
import { useAllBooks, useLibrary } from '../app/library';
import { useI18n } from '../i18n';
import { exportMarkdown } from '../data/export-notes';
import { AiError, getApiKey, inferSeries } from '../sources/ai';
import { shareFile } from '../sources/share-file';

export function LibraryTools({
  toast,
  onNeedAi,
}: {
  toast: (m: string) => void;
  onNeedAi: () => void;
}) {
  const lib = useLibrary();
  const books = useAllBooks() ?? [];
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const enrich = useEnrichProgress();

  const incomplete = books.filter(needsData);
  const noSeries = books.filter((b) => !b.series);

  async function importFiles(files: File[]) {
    setBusy(t('tools.importing'));
    try {
      const r = await importFromFiles(lib, files);
      if (!r.added && !r.skipped) return toast(t('tools.nothingFound'));
      toast(t('tools.imported', { added: r.added, skipped: r.skipped }));
    } catch (error) {
      console.error(error);
      toast(t('tools.importFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function exportNotes() {
    try {
      const md = exportMarkdown(books);
      const date = new Date().toISOString().slice(0, 10);
      const shared = await shareFile(
        `Bookloft ${date}.md`,
        new Blob([md], { type: 'text/markdown' }),
      );
      if (shared) toast(t('tools.exported', { n: books.length }));
    } catch (error) {
      console.error(error);
      toast(t('share.failed'));
    }
  }

  async function sortSeries() {
    const key = await getApiKey();
    if (!key) return onNeedAi();
    setBusy(t('tools.sortingSeries', { n: noSeries.length }));
    try {
      const guesses = await inferSeries(
        key,
        noSeries.map((b) => ({ id: b.id, title: b.title, author: b.authors[0] ?? null })),
      );
      let n = 0;
      for (const g of guesses) {
        if (!g.series) continue;
        await lib.updateBook(g.id, { series: g.series, series_index: g.index });
        n++;
      }
      toast(n ? t('tools.seriesDone', { n }) : t('tools.seriesNone'));
    } catch (e) {
      const kind = e instanceof AiError ? e.kind : 'other';
      toast(t(`ai.error.${kind}`));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="library-tools">
      <h2 className="detail-label">{t('tools.title')}</h2>
      <p className="hint">{t('tools.explain')}</p>
      <div className="backup-actions">
        <button className="button" disabled={!!busy} onClick={() => input.current?.click()}>
          <FileUp size={18} strokeWidth={1.5} aria-hidden />
          {t('tools.import')}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={IMPORT_ACCEPT}
          hidden
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = '';
            if (list.length) void importFiles(list);
          }}
        />
        {books.length > 0 && (
          <button className="button" disabled={!!busy} onClick={() => void exportNotes()}>
            <FileDown size={18} strokeWidth={1.5} aria-hidden />
            {t('tools.export')}
          </button>
        )}
        {incomplete.length > 0 && !enrich && (
          <button className="button" disabled={!!busy} onClick={() => enrichBooks(lib, incomplete)}>
            <LibraryIcon size={18} strokeWidth={1.5} aria-hidden />
            {t('tools.complete', { n: incomplete.length })}
          </button>
        )}
        {noSeries.length > 0 && (
          <button className="button" disabled={!!busy} onClick={() => void sortSeries()}>
            <Sparkles size={18} strokeWidth={1.5} aria-hidden />
            {t('tools.series')}
          </button>
        )}
      </div>
      {busy && <p className="hint pulse">{busy}</p>}
      {enrich && (
        <p className="hint pulse">
          {t('tools.enriching', { done: enrich.done, total: enrich.total })}
        </p>
      )}
    </section>
  );
}
