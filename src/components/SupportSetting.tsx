// Apoyar la app con una propina en Ko-fi. Solo en la versión de GitHub: Google Play no permite
// links de donación externos (ahí irá una compra dentro de la app, Fase 7).
import { Coffee } from 'lucide-react';
import { useI18n } from '../i18n';

export const KOFI_URL = 'https://ko-fi.com/kbzonzito';

export function SupportSetting() {
  const { t } = useI18n();
  if (__DISTRIBUTION__ !== 'github') return null;
  return (
    <section className="support">
      <h2 className="detail-label">{t('support.title')}</h2>
      <p className="hint">{t('support.explain')}</p>
      <a className="button support-button" href={KOFI_URL} target="_blank" rel="noreferrer">
        <Coffee size={18} strokeWidth={1.6} aria-hidden />
        {t('support.kofi')}
      </a>
    </section>
  );
}
