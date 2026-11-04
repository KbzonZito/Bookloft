// Ajuste "Portadas sin conexión": guardar una copia chica de cada portada en el teléfono
import { useEffect, useState } from 'react';
import { useLibrary } from '../app/library';
import {
  offlineCoversSize,
  offlineSupported,
  setOfflineCovers,
  useOfflineCovers,
} from '../app/offline-covers';
import { useI18n } from '../i18n';
import { formatSize } from '../sources/epub';
import { Segmented } from './Controls';

export function OfflineCoversSetting() {
  const lib = useLibrary();
  const { t } = useI18n();
  const { enabled, progress } = useOfflineCovers();
  const [size, setSize] = useState<{ files: number; bytes: number } | null>(null);

  useEffect(() => {
    if (enabled && !progress) void offlineCoversSize().then(setSize);
    else if (!enabled) setSize(null);
  }, [enabled, progress]);

  if (!offlineSupported) return null;
  return (
    <section>
      <h2 className="detail-label">{t('offline.title')}</h2>
      <p className="hint">{t('offline.explain')}</p>
      <Segmented
        label={t('offline.title')}
        value={enabled ? 'on' : 'off'}
        options={[
          { value: 'off', label: t('offline.off') },
          { value: 'on', label: t('offline.on') },
        ]}
        onChange={(v) => void setOfflineCovers(lib, v === 'on')}
      />
      {progress && (
        <p className="hint pulse">
          {t('offline.progress', { done: progress.done, total: progress.total })}
        </p>
      )}
      {!progress && size && (
        <p className="hint">{t('offline.size', { n: size.files, size: formatSize(size.bytes) })}</p>
      )}
    </section>
  );
}
