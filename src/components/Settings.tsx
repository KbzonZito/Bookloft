// Ajustes: apariencia, idioma y respaldo JSON (el respaldo completo con Drive llega en la Fase 5)
import { useI18n, type Lang } from '../i18n';
import { AiSettings } from './AiSettings';
import { BackupSettings } from './BackupSettings';
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
  const { t } = useI18n();

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

        <BackupSettings toast={toast} />

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
