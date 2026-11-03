// Resortes compartidos: toda la app se mueve con la misma física
import type { Transition } from 'motion/react';

export const spring = {
  /** Cosas pequeñas que siguen al dedo o a un toque: la cinta, los chips */
  snappy: { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } satisfies Transition,
  /** La portada que vuela a la ficha y vuelve */
  cover: { type: 'spring', stiffness: 430, damping: 38, mass: 0.85 } satisfies Transition,
  /** Hojas y paneles que entran */
  sheet: { type: 'spring', stiffness: 380, damping: 40 } satisfies Transition,
};

export const fade = { duration: 0.18, ease: [0.2, 0, 0, 1] } satisfies Transition;
