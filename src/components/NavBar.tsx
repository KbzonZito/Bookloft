// Barra de navegación flotante (adaptada de Printer Hub). Los íconos inactivos van solos; el activo
// crece hasta ícono + nombre y la barra se acomoda alrededor. En tablet horizontal es un riel vertical.
import { Plus, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { haptic } from '../app/native';

export function NavBar<T extends string>({
  tabs,
  active,
  onSelect,
  label,
  onAdd,
  addLabel,
}: {
  tabs: { id: T; icon: LucideIcon; badge?: number }[];
  active: T;
  onSelect: (id: T) => void;
  label: (id: T) => string;
  onAdd: () => void;
  addLabel: string;
}) {
  const barRef = useRef<HTMLElement>(null);
  const labels = tabs.map((x) => label(x.id)).join('|');

  // El nombre crece hasta su ancho real medido, nunca más: así no hay rebote en la animación
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const text = e.target as HTMLElement;
        text.parentElement!.style.setProperty('--label-w', `${Math.ceil(text.offsetWidth)}px`);
      }
    });
    const spans = bar.querySelectorAll<HTMLElement>('.tab-label > span');
    spans.forEach((el) => ro.observe(el));
    // Por si la fuente llega después de medir con la de respaldo (pasaba en el WebView de Android)
    void document.fonts?.ready.then(() =>
      spans.forEach((el) =>
        el.parentElement!.style.setProperty('--label-w', `${Math.ceil(el.offsetWidth)}px`),
      ),
    );
    return () => ro.disconnect();
  }, [labels]);

  return (
    <nav className="tabbar" ref={barRef}>
      {tabs.map(({ id, icon: Icon, badge }) => (
        <button
          key={id}
          className={active === id ? 'active' : ''}
          aria-current={active === id ? 'page' : undefined}
          aria-label={label(id)}
          onClick={() => {
            if (id !== active) haptic.tick();
            onSelect(id);
          }}
        >
          <Icon size={22} strokeWidth={1.6} aria-hidden />
          <span className="tab-label" aria-hidden>
            <span>{label(id)}</span>
          </span>
          {!!badge && <span className="tab-badge">{badge}</span>}
        </button>
      ))}
      <button className="tab-add" onClick={onAdd} aria-label={addLabel}>
        <Plus size={24} strokeWidth={2} aria-hidden />
      </button>
    </nav>
  );
}
