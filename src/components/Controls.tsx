// Controles pequeños de la ficha: selector segmentado con píldora que se desliza y estrellas de a media
import { motion } from 'motion/react';
import { useId, useState } from 'react';
import { haptic } from '../app/native';
import { useI18n } from '../i18n';
import { spring } from '../ui/motion';

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  wrap = false,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Muchas opciones en poco ancho: que bajen a otra línea en vez de cortarse */
  wrap?: boolean;
}) {
  const id = useId();
  return (
    <div className={`segmented ${wrap ? 'wrap' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            className="segment"
            onClick={() => {
              if (on) return;
              haptic.tap();
              onChange(o.value);
            }}
          >
            {on && (
              <motion.span
                className="segment-pill"
                layoutId={`pill-${id}`}
                transition={spring.snappy}
              />
            )}
            <span className="segment-label">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const STAR = 'M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

/** Cinco estrellas: tocar la mitad izquierda da media estrella; tocar el valor actual lo borra */
export function Rating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { t } = useI18n();
  const clip = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const pick = (n: number) => {
    haptic.tap();
    onChange(n === value ? null : n);
  };
  return (
    <div
      className="rating"
      role="slider"
      aria-label={t('book.rating')}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value ?? 0}
      aria-valuetext={value ? t('book.ratingValue', { n: value }) : '—'}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onChange(Math.min(5, (value ?? 0) + 0.5));
        if (e.key === 'ArrowLeft') onChange((value ?? 0) - 0.5 || null);
      }}
      onPointerLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, shown - (n - 1)));
        return (
          <span key={n} className="star">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d={STAR} className="star-empty" />
              <clipPath id={`${clip}-${n}`}>
                <rect x="0" y="0" width={24 * fill} height="24" />
              </clipPath>
              <motion.path
                d={STAR}
                className="star-full"
                clipPath={`url(#${clip}-${n})`}
                animate={{ scale: fill > 0 ? 1 : 0.6 }}
                transition={spring.snappy}
                style={{ transformOrigin: 'center' }}
              />
            </svg>
            <button
              className="star-half left"
              tabIndex={-1}
              aria-hidden
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(n - 0.5)}
              onClick={() => pick(n - 0.5)}
            />
            <button
              className="star-half right"
              tabIndex={-1}
              aria-hidden
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(n)}
              onClick={() => pick(n)}
            />
          </span>
        );
      })}
    </div>
  );
}
