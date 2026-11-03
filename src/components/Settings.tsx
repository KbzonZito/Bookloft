// Ajustes: apariencia, idioma y respaldo JSON (el respaldo completo con Drive llega en la Fase 5)
import { Capacitor } from '@capacitor/core';
import { useRef } from 'react';
import { useLibrary } from '../app/library';
import { exportJson, importJson } from '../data';
import { useI18n, type Lang } from '../i18n';
import { AiSettings } from './AiSettings';
import { Segmented } from './Controls';
import { Sheet } from './Sheet';

export type ThemeSetting = 'auto' | 'light' | 'dark';
export type LangSetting = 'auto' | Lang;

export function Settings({
  theme,
  setTheme,
  lang,
  setLang,
  onClose,
  toast,
  onLoadSample,
  aiFocus = false,
}: {
  theme: ThemeSetting;
  setTheme: (t: ThemeSetting) => void;
  lang: LangSetting;
  setLang: (l: LangSetting) => void;
  onClose: () => void;
  toast: (message: string) => void;
  onLoadSample?: () => void;
  /** Abrir directo en conectar la IA (por ejemplo, desde un error en la bandeja) */
  aiFocus?: boolean;
}) {
  const lib = useLibrary();
  const { t } = useI18n();
  const file = useRef<HTMLInputElement>(null);

  async function exportLibrary() {
    if (Capacitor.isNativePlatform()) return toast(t('settings.exportNative'));
    const json = JSON.stringify(await exportJson(lib, __APP_VERSION__));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `biblioteca-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    try {
      const r = await importJson(lib, JSON.parse(await f.text()));
      toast(t('settings.imported', { added: r.added, updated: r.updated, invalid: r.invalid }));
    } catch (error) {
      toast(
        t('settings.importFailed', { msg: error instanceof Error ? error.message : String(error) }),
      );
    }
  }

  return (
    <Sheet label={t('settings.title')} onClose={onClose} className="form-sheet">
      <div className="settings">
        <h1 className="sheet-title">{t('settings.title')}</h1>

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

        <AiSettings startEditing={aiFocus} />

        <section>
          <h2 className="detail-label">{t('settings.backup')}</h2>
          <div className="button-row">
            <button className="button" onClick={exportLibrary}>
              {t('settings.export')}
            </button>
            <button className="button" onClick={() => file.current?.click()}>
              {t('settings.import')}
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        {onLoadSample && (
          <section>
            <h2 className="detail-label">{t('settings.dev')}</h2>
            <button className="button" onClick={onLoadSample}>
              {t('empty.sample')}
            </button>
          </section>
        )}

        <p className="hint">{t('settings.version', { v: __APP_VERSION__ })}</p>
      </div>
    </Sheet>
  );
}
