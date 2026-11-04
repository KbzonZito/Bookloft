// Elegir la paleta de color: una muestra por paleta (papel, tinta y acento) con su nombre
import { Check } from 'lucide-react';
import {
  PALETTE_IDS,
  paletteSwatch,
  systemColorsAvailable,
  type PaletteId,
  type useSystemPalette,
} from '../app/palette';
import { useI18n } from '../i18n';

export interface PaletteControl {
  value: PaletteId;
  set: (p: PaletteId) => void;
  dark: boolean;
  system: ReturnType<typeof useSystemPalette>;
}

export function PalettePicker({ value, set, dark, system }: PaletteControl) {
  const { t } = useI18n();
  // "Dispositivo" solo en Android 12+ (Material You); en otro lado no tendría colores propios
  const ids = PALETTE_IDS.filter((id) => id !== 'system' || (systemColorsAvailable && system));
  return (
    <section>
      <h2 className="detail-label">{t('settings.palette')}</h2>
      <div className="palettes" role="radiogroup" aria-label={t('settings.palette')}>
        {ids.map((id) => {
          const s = paletteSwatch(id, dark, system);
          return (
            <button
              key={id}
              role="radio"
              aria-checked={value === id}
              className={`palette ${value === id ? 'active' : ''}`}
              onClick={() => set(id)}
            >
              <span className="swatch" style={{ background: s.paper, borderColor: s.line }}>
                <span style={{ background: s.ink }} />
                <span style={{ background: s.accent }}>
                  {value === id && <Check size={14} strokeWidth={2.5} color={s.accentInk} />}
                </span>
              </span>
              <span className="palette-name">{t(`palette.${id}`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
