// Respaldos: guardar un ZIP (solo la biblioteca o completo, con la bóveda) y restaurarlo
import { DatabaseBackup, FileSpreadsheet, FolderArchive, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAllBooks, useLibrary } from '../app/library';
import { exportCsv } from '../data/export-csv';
import { shareFile } from '../sources/share-file';
import { useI18n } from '../i18n';
import {
  createBackup,
  daysSinceBackup,
  deliverBackup,
  RestoreError,
  restoreBackup,
} from '../sources/backup-zip';
import { formatSize } from '../sources/epub';
import { useFiles } from './Vault';

export function BackupSettings({ toast }: { toast: (m: string) => void }) {
  const lib = useLibrary();
  const { t, lang } = useI18n();
  const files = useFiles();
  const books = useAllBooks() ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () => void daysSinceBackup(lib).then((d) => alive && setDays(d));
    load();
    const stop = lib.onChange(load);
    return () => {
      alive = false;
      stop();
    };
  }, [lib]);

  const vaultSize = (files ?? []).reduce((n, f) => n + f.size, 0);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });

  async function backup(withFiles: boolean) {
    setBusy(t('backup.preparing'));
    try {
      const file = await createBackup(lib, { withFiles, appVersion: __APP_VERSION__ });
      setBusy(null);
      let delivered: boolean;
      try {
        delivered = await deliverBackup(lib, file);
      } catch {
        return toast(t('share.failed'));
      }
      if (delivered) {
        toast(
          file.missing
            ? t('backup.doneMissing', { n: file.missing })
            : t('backup.done', { size: formatSize(file.size) }),
        );
      }
    } catch (error) {
      console.error(error);
      toast(t('backup.failed'));
    } finally {
      setBusy(null);
    }
  }

  async function backupCsv() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const csv = new Blob([exportCsv(books)], { type: 'text/csv' });
      if (await shareFile(`Biblioteca ${date}.csv`, csv)) {
        toast(t('backup.csvDone', { n: books.length }));
      }
    } catch (error) {
      console.error(error);
      toast(t('share.failed'));
    }
  }

  async function restore(file: File) {
    setBusy(t('backup.restoring'));
    try {
      const r = await restoreBackup(lib, file);
      toast(
        t('backup.restored', {
          added: r.added,
          updated: r.updated,
          files: r.filesRestored,
        }),
      );
    } catch (error) {
      toast(
        error instanceof RestoreError && error.kind === 'not_backup'
          ? t('backup.notBackup')
          : t('backup.corrupt'),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="backup-settings">
      <h2 className="detail-label">{t('settings.backup')}</h2>
      {days !== undefined && (
        <p className={`backup-status ${days === null || days > 30 ? 'stale' : ''}`}>
          {days === null ? t('backup.never') : t('backup.last', { when: rtf.format(-days, 'day') })}
        </p>
      )}
      <p className="hint">{t('backup.explain')}</p>

      <div className="backup-actions">
        <button className="button" disabled={!!busy} onClick={() => void backup(false)}>
          <DatabaseBackup size={18} strokeWidth={1.5} aria-hidden />
          {t('backup.light')}
        </button>
        <button className="button" disabled={!!busy} onClick={() => void backup(true)}>
          <FolderArchive size={18} strokeWidth={1.5} aria-hidden />
          {files?.length
            ? t('backup.full', { size: formatSize(vaultSize) })
            : t('backup.fullEmpty')}
        </button>
        {books.length > 0 && (
          <button className="button" disabled={!!busy} onClick={() => void backupCsv()}>
            <FileSpreadsheet size={18} strokeWidth={1.5} aria-hidden />
            {t('backup.csv')}
          </button>
        )}
        <button className="button quiet" disabled={!!busy} onClick={() => input.current?.click()}>
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden />
          {t('backup.restore')}
        </button>
        <input
          ref={input}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void restore(f);
          }}
        />
      </div>
      {busy && <p className="hint pulse">{busy}</p>}
    </section>
  );
}
