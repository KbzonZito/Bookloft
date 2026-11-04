// Organizar la biblioteca: importar notas o listas, completar datos y portadas, ordenar en sagas con IA
import { FileUp, Library as LibraryIcon, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { enrichBooks, needsData, useEnrichProgress } from '../app/enrich';
import { useAllBooks, useLibrary } from '../app/library';
import { importBooks, importJson, parseJsonBooks, parseMarkdown, type ImportedBook } from '../data';
import { useI18n } from '../i18n';
import { AiError, getApiKey, inferSeries } from '../sources/ai';

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
      const items: ImportedBook[] = [];
      let restored = 0;
      for (const f of files) {
        const text = await f.text();
        if (/\.json$/i.test(f.name) || /^\s*[[{]/.test(text)) {
          const data: unknown = JSON.parse(text);
          // Un respaldo de esta app se fusiona como respaldo (por id, gana lo más nuevo)
          if (data && typeof data === 'object' && 'format' in data) {
            const r = await importJson(lib, data);
            restored += r.added;
          } else items.push(...parseJsonBooks(data));
        } else items.push(...parseMarkdown(text, f.name));
      }
      if (!items.length && !restored) return toast(t('tools.nothingFound'));
      const r = await importBooks(lib, items);
      toast(
        t('tools.imported', {
          added: r.added.length + restored,
          skipped: r.skipped,
        }),
      );
      // Portadas, autores y años, de a poco y sin bloquear
      enrichBooks(lib, r.added);
    } catch (error) {
      console.error(error);
      toast(t('tools.importFailed'));
    } finally {
      setBusy(null);
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
          accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
          hidden
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            e.target.value = '';
            if (list.length) void importFiles(list);
          }}
        />
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
