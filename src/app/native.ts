// Lo que cambia entre el teléfono y el navegador: háptica, botón atrás y barras del sistema
import { App } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useEffect, useRef } from 'react';

const native = Capacitor.isNativePlatform();

// Se puede apagar en Ajustes; App la mantiene al día con el ajuste guardado
let hapticsOn = true;
export const setHapticsEnabled = (on: boolean) => {
  hapticsOn = on;
};

export const haptic = {
  /** Un toque suave al confirmar algo (cambiar de estado, calificar) */
  tap: () =>
    void (native && hapticsOn && Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})),
  /** Un clic al pasar por opciones (cambiar de estante deslizando) */
  tick: () => void (native && hapticsOn && Haptics.selectionChanged().catch(() => {})),
};

export async function setSystemBars(dark: boolean) {
  if (!native) return;
  await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(
    () => {},
  );
}

// Pila de cosas que el botón atrás de Android cierra, de la más nueva a la más vieja
const backStack: { current: () => void }[] = [];

if (native) {
  void App.addListener('backButton', () => {
    const top = backStack.at(-1);
    if (top) top.current();
    else void App.minimizeApp();
  });
}

/** Mientras `active`, el botón atrás (y Escape) llama a `onBack` en vez de salir */
export function useBack(active: boolean, onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => ref.current() };
    backStack.push(entry);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && backStack.at(-1) === entry) ref.current();
    };
    addEventListener('keydown', onKey);
    return () => {
      backStack.splice(backStack.indexOf(entry), 1);
      removeEventListener('keydown', onKey);
    };
  }, [active]);
}
