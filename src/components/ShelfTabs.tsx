// Los estantes como tipografía: el activo queda marcado por una cinta de marcapáginas que se desliza
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import type { Status } from '../data';
import { useI18n } from '../i18n';
import { SHELVES } from '../app/shelves';
import { spring } from '../ui/motion';

export function ShelfTabs({
  active,
  counts,
  onSelect,
  orientation = 'horizontal',
}: {
  active: Status | null;
  counts: Record<Status, number>;
  onSelect: (s: Status) => void;
  orientation?: 'horizontal' | 'vertical';
}) {
  const { shelf, t } = useI18n();
  const nav = useRef<HTMLElement>(null);
  const refs = useRef(new Map<Status, HTMLButtonElement>());

  // Al deslizar entre estantes, el activo queda alineado al margen izquierdo
  useEffect(() => {
    const el = active && refs.current.get(active);
    if (!el || !nav.current || orientation !== 'horizontal') return;
    const gutter = parseFloat(getComputedStyle(nav.current).paddingLeft);
    nav.current.scrollTo({
      left: el.offsetLeft - nav.current.offsetLeft - gutter,
      behavior: 'smooth',
    });
  }, [active, orientation]);

  return (
    <nav ref={nav} className={`shelves ${orientation}`} aria-label={t('app.shelves')}>
      {SHELVES.map((s) => (
        <button
          key={s}
          ref={(el) => void (el ? refs.current.set(s, el) : refs.current.delete(s))}
          className="shelf-tab"
          aria-current={active === s ? 'page' : undefined}
          onClick={() => onSelect(s)}
        >
          <span className="shelf-name">{shelf(s)}</span>
          <span className="shelf-count">{counts[s]}</span>
          {active === s && (
            <motion.span
              className="ribbon"
              layoutId={`ribbon-${orientation}`}
              transition={spring.snappy}
            />
          )}
        </button>
      ))}
    </nav>
  );
}
