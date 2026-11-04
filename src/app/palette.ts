// Paletas de color: cada una con su versión de día y de noche. "Dispositivo" usa los colores de
// Material You (Android 12+), que salen del fondo de pantalla. Las portadas siguen poniendo el
// color; la paleta solo cambia el papel, la tinta y el acento.
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useEffect, useState } from 'react';

interface Tokens {
  paper: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  accentInk: string;
}

// prettier-ignore
export const PALETTES = {
  // Sala de lectura: gris verdoso y cinta burdeo; de noche, madera y vela
  library: {
    light: { paper: '#eceeea', surface: '#f7f8f5', surface2: '#e3e6e0', ink: '#1c1f1d', ink2: '#5f645f', ink3: '#959a94', line: '#d6dad3', accent: '#8c2b3a', accentInk: '#f7f8f5' },
    dark: { paper: '#15120f', surface: '#1d1915', surface2: '#27211c', ink: '#ede6da', ink2: '#a49a8c', ink3: '#6f665b', line: '#2e2721', accent: '#e0a75e', accentInk: '#15120f' },
  },
  // Té con leche: papel crema y terracota
  tea: {
    light: { paper: '#f2ece2', surface: '#faf6ef', surface2: '#e8e0d3', ink: '#2a2420', ink2: '#6b6058', ink3: '#a1958a', line: '#ddd3c4', accent: '#a8532f', accentInk: '#faf6ef' },
    dark: { paper: '#17120f', surface: '#201a16', surface2: '#2b231d', ink: '#efe5d8', ink2: '#a89a8a', ink3: '#75685b', line: '#31281f', accent: '#e3925f', accentInk: '#17120f' },
  },
  // Bosque: verdes de musgo
  forest: {
    light: { paper: '#e7ece4', surface: '#f4f7f1', surface2: '#dbe2d6', ink: '#18201a', ink2: '#56625a', ink3: '#8f9a91', line: '#ccd5c7', accent: '#2f6247', accentInk: '#f4f7f1' },
    dark: { paper: '#0f1411', surface: '#161c18', surface2: '#1f2722', ink: '#e2eadf', ink2: '#9aa89c', ink3: '#67746a', line: '#26302a', accent: '#8fc6a0', accentInk: '#0f1411' },
  },
  // Crepúsculo: lavanda y ciruela
  dusk: {
    light: { paper: '#ecebf0', surface: '#f7f6fa', surface2: '#e1dfe8', ink: '#1e1b24', ink2: '#625d6c', ink3: '#9893a2', line: '#d6d3de', accent: '#6a4c8c', accentInk: '#f7f6fa' },
    dark: { paper: '#131119', surface: '#1a1722', surface2: '#23202d', ink: '#e9e5f0', ink2: '#a59fb2', ink3: '#6f697c', line: '#2b2736', accent: '#bba3e3', accentInk: '#131119' },
  },
  // Niebla: azul pizarra junto al mar
  mist: {
    light: { paper: '#e7ecee', surface: '#f4f7f8', surface2: '#dae1e4', ink: '#172024', ink2: '#56646a', ink3: '#8e9ba1', line: '#ccd6da', accent: '#2e6378', accentInk: '#f4f7f8' },
    dark: { paper: '#0e1316', surface: '#151b1f', surface2: '#1d252a', ink: '#e0e9ec', ink2: '#98a8ae', ink3: '#66757b', line: '#243037', accent: '#85bdd2', accentInk: '#0e1316' },
  },
} satisfies Record<string, { light: Tokens; dark: Tokens }>;

export type PaletteId = keyof typeof PALETTES | 'system';
export const PALETTE_IDS = [...(Object.keys(PALETTES) as PaletteId[]), 'system'] as const;

// ---------- Colores del dispositivo ----------

type Tones = Record<string, string>;
interface SystemColorsResult {
  supported: boolean;
  accent1?: Tones;
  neutral1?: Tones;
  neutral2?: Tones;
}
const SystemColors = registerPlugin<{
  get(): Promise<SystemColorsResult>;
  setWindowBackground(o: { color: string }): Promise<void>;
}>('SystemColors');

export const systemColorsAvailable = Capacitor.getPlatform() === 'android';

/** Material You → nuestros tokens (los mismos tonos que usan las apps de Google) */
function fromSystem(c: SystemColorsResult): { light: Tokens; dark: Tokens } | null {
  const { accent1: a, neutral1: n, neutral2: v } = c;
  if (!c.supported || !a || !n || !v) return null;
  // prettier-ignore
  return {
    light: { paper: n['50'], surface: n['10'], surface2: v['100'], ink: n['900'], ink2: v['700'], ink3: v['500'], line: v['200'], accent: a['600'], accentInk: a['0'] },
    dark: { paper: n['900'], surface: n['800'], surface2: v['800'], ink: n['50'], ink2: v['200'], ink3: v['400'], line: v['700'], accent: a['200'], accentInk: a['800'] },
  };
}

/** Los colores del sistema; se vuelven a leer al volver a la app (por si cambió el fondo de pantalla) */
export function useSystemPalette() {
  const [palette, setPalette] = useState<{ light: Tokens; dark: Tokens } | null>(null);
  useEffect(() => {
    if (!systemColorsAvailable) return;
    const read = () =>
      void SystemColors.get()
        .then((c) => setPalette(fromSystem(c)))
        .catch(() => setPalette(null));
    read();
    const sub = App.addListener('resume', read);
    return () => void sub.then((s) => s.remove());
  }, []);
  return palette;
}

const VARS: Record<keyof Tokens, string> = {
  paper: '--paper',
  surface: '--surface',
  surface2: '--surface-2',
  ink: '--ink',
  ink2: '--ink-2',
  ink3: '--ink-3',
  line: '--line',
  accent: '--accent',
  accentInk: '--accent-ink',
};

export function applyPalette(
  id: PaletteId,
  dark: boolean,
  system: { light: Tokens; dark: Tokens } | null,
) {
  const set = id === 'system' ? (system ?? PALETTES.library) : PALETTES[id];
  const tokens = dark ? set.dark : set.light;
  const style = document.documentElement.style;
  for (const [k, v] of Object.entries(VARS)) style.setProperty(v, tokens[k as keyof Tokens]);
}

/** Para dibujar la muestra de cada paleta en Ajustes */
export function paletteSwatch(
  id: PaletteId,
  dark: boolean,
  system: { light: Tokens; dark: Tokens } | null,
) {
  const set = id === 'system' ? (system ?? PALETTES.library) : PALETTES[id];
  return dark ? set.dark : set.light;
}

/**
 * El fondo de la ventana y las barras del sistema, del color del papel. Va después de fijar el
 * estilo de las barras: ese cambio vuelve a pintarlas con el color del tema de Android.
 */
export function paintWindow(color: string) {
  if (systemColorsAvailable) void SystemColors.setWindowBackground({ color }).catch(() => {});
}
