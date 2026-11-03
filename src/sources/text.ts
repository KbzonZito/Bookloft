// Sacar pistas de un texto compartido o de lo que leyó el OCR, sin IA

/** ISBN-10 o ISBN-13 con dígito verificador válido, normalizado a 13 dígitos */
export function findIsbns(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/(?:97[89][-\s]?)?(?:\d[-\s]?){9}[\dXx]/g)) {
    const raw = m[0].replace(/[-\s]/g, '').toUpperCase();
    if (raw.length === 13 && validIsbn13(raw)) found.add(raw);
    else if (raw.length === 10 && validIsbn10(raw)) found.add(isbn10to13(raw));
  }
  return [...found];
}

function validIsbn13(s: string) {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  const sum = [...s].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

function validIsbn10(s: string) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  const sum = [...s].reduce((acc, d, i) => acc + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
  return sum % 11 === 0;
}

export function isbn10to13(isbn10: string) {
  const body = `978${isbn10.slice(0, 9)}`;
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

export const findUrls = (text: string) => text.match(/https?:\/\/\S+/g) ?? [];

/** Lo que no es un libro en un post: links, cuentas, hashtags, contadores y avisos */
function isNoise(line: string) {
  return (
    line.length < 3 ||
    /https?:\/\//.test(line) ||
    /^[@#]/.test(line) ||
    /^\d+([.,]\d+)?\s*[kKmM]?\s*(me gusta|likes?|comentarios?|comments?|views?|vistas?)?$/i.test(
      line,
    ) ||
    /\b(seguir|follow|instagram|reels?|audio original|original audio|ver traducción|see translation)\b/i.test(
      line,
    )
  );
}

/**
 * Posibles títulos para buscar: lo que está entre comillas primero, después las líneas
 * que no son ruido. Hasta `max`, sin repetir.
 */
export function guessQueries(text: string, max = 3): string[] {
  const out: string[] = [];
  const add = (q: string) => {
    const clean = q
      .replace(/[#@]\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length >= 3 && !out.some((o) => o.toLowerCase() === clean.toLowerCase())) {
      out.push(clean.slice(0, 80));
    }
  };
  for (const m of text.matchAll(/[«“"']([^«»“”"']{3,80})[»”"']/g)) add(m[1]);
  for (const line of text.split(/\n+/).map((l) => l.trim())) {
    if (out.length >= max) break;
    if (!isNoise(line)) add(line);
  }
  return out.slice(0, max);
}

export interface OcrLine {
  text: string;
  /** Alto de la línea en píxeles: los títulos suelen ser lo más grande de la portada */
  height: number;
  /** Posición vertical, para leer las líneas en orden */
  top: number;
}

/** "PRO JE CT" (letras espaciadas en la portada) → "PROJECT"; sin puntos sueltos al final */
function cleanOcrLine(text: string) {
  const tokens = text
    .trim()
    .replace(/[.,;:]+$/, '')
    .split(/\s+/);
  return tokens.length > 1 && tokens.every((t) => t.length <= 3)
    ? tokens.join('')
    : tokens.join(' ');
}

/**
 * Qué buscar a partir de lo que leyó el OCR. En las portadas el título y el autor suelen estar
 * partidos en varias líneas grandes ("HAIL" / "MARY" / "ANDY" / "WEIR"), así que primero se buscan
 * todas las líneas grandes juntas, en orden de lectura; después, las más grandes por separado.
 */
export function titleLines(lines: OcrLine[], max = 3): string[] {
  const useful = lines
    .map((l) => ({ ...l, text: cleanOcrLine(l.text) }))
    .filter((l) => !isNoise(l.text));
  if (!useful.length) return [];
  const tallest = Math.max(...useful.map((l) => l.height));
  const big = useful.filter((l) => l.height >= tallest * 0.45).sort((a, b) => a.top - b.top);
  const combined =
    big.length > 1
      ? [
          big
            .map((l) => l.text)
            .join(' ')
            .slice(0, 80),
        ]
      : [];
  const single = [...useful].sort((a, b) => b.height - a.height).map((l) => l.text);
  // Sin la regla de comillas de guessQueries: en una portada, lo citado son reseñas, no el título
  const out: string[] = [];
  for (const q of [...combined, ...single]) {
    if (q.length >= 3 && !out.some((o) => o.toLowerCase() === q.toLowerCase())) out.push(q);
  }
  return out.slice(0, max);
}
