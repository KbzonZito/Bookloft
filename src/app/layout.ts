// Tamaño de ventana según Material: teléfono < 600, tablet vertical < 840, tablet horizontal o escritorio
import { useSyncExternalStore } from 'react';

export type WindowSize = 'compact' | 'medium' | 'expanded';

const medium = matchMedia('(min-width: 600px)');
const expanded = matchMedia('(min-width: 840px)');

function current(): WindowSize {
  return expanded.matches ? 'expanded' : medium.matches ? 'medium' : 'compact';
}

function subscribe(onChange: () => void) {
  medium.addEventListener('change', onChange);
  expanded.addEventListener('change', onChange);
  return () => {
    medium.removeEventListener('change', onChange);
    expanded.removeEventListener('change', onChange);
  };
}

export const useWindowSize = () => useSyncExternalStore(subscribe, current);
