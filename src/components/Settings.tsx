// Ajustes: apariencia, idioma, IA, organizar la biblioteca y respaldos
import { useI18n, type Lang } from '../i18n';
import { AiSettings } from './AiSettings';
import { BackupSettings } from './BackupSettings';
import { Segmented } from './Controls';
import { LibraryTools } from './LibraryTools';
import { OfflineCoversSetting } from './OfflineCoversSetting';

export type ThemeSetting = 'auto' | 'light' | 'dark';
export type LangSetting = 'auto' | Lang;

export function Settings({
  theme,
  setTheme,
  lang,
  setLang,
  toast,
  onLoadSample,
  aiFocus = false,
}: {
  theme: ThemeSetting;
  setTheme: (t: ThemeSetting) => void;
  lang: LangSetting;
  setLang: (l: LangSetting) => void;
  toast: (message: string) => void;
  onLoadSample?: () => void;
  /** Abrir directo en conectar la IA (por ejemplo, desde un error en la bandeja) */
  aiFocus?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="settings">
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

      <OfflineCoversSetting />

      <AiSettings startEditing={aiFocus} />

      <LibraryTools
        toast={toast}
        onNeedAi={() => {
          toast(t('tools.needAi'));
          document.querySelector('.ai-settings')?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

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
  );
}
