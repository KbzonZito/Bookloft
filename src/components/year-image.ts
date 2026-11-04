// La imagen para compartir el resumen del año (formato historia, 1080×1920), dibujada en un
// canvas con los colores de la paleta actual y las portadas de los mejor calificados.
import type { YearStats } from '../app/year';
import type { Book } from '../data';
import type { MessageKey, Vars } from '../i18n';
import { bookCover } from './Cover';

const W = 1080;
const H = 1920;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 8000);
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Corta un texto con "…" para que quepa en el ancho */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export async function renderYearImage(
  s: YearStats,
  t: (key: MessageKey, vars?: Vars) => string,
  lang: string,
): Promise<Blob> {
  await document.fonts?.ready;
  const css = getComputedStyle(document.documentElement);
  const color = (v: string) => css.getPropertyValue(v).trim();
  const [paper, surface, ink, ink2, line, accent] = [
    '--paper',
    '--surface',
    '--ink',
    '--ink-2',
    '--line',
    '--accent',
  ].map(color);
  const serif = "'Newsreader Variable', Georgia, serif";
  const sans = "'Instrument Sans Variable', system-ui, sans-serif";
  const fmt = (n: number) => new Intl.NumberFormat(lang).format(n);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);

  // La cinta marcapáginas, el acento de la app
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(110, 0);
  ctx.lineTo(160, 0);
  ctx.lineTo(160, 150);
  ctx.lineTo(135, 128);
  ctx.lineTo(110, 150);
  ctx.closePath();
  ctx.fill();

  const left = 110;
  ctx.fillStyle = ink2;
  ctx.font = `600 40px ${sans}`;
  ctx.fillText(t('year.imageKicker'), left, 260);
  ctx.fillStyle = ink;
  ctx.font = `400 120px ${serif}`;
  ctx.fillText(String(s.year), left, 390);

  // El número grande
  ctx.fillStyle = accent;
  ctx.font = `400 330px ${serif}`;
  ctx.fillText(String(s.books.length), left - 10, 720);
  ctx.fillStyle = ink;
  ctx.font = `500 54px ${sans}`;
  ctx.fillText(s.books.length === 1 ? t('year.book') : t('year.books'), left, 800);

  // Tres datos en fila
  const facts: [string, string][] = [];
  if (s.withPages) facts.push([fmt(s.pages), t('year.pages')]);
  const one = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (s.avgRating) facts.push([`★ ${one.format(s.avgRating)}`, t('year.avg')]);
  if (s.seriesCompleted.length)
    facts.push([String(s.seriesCompleted.length), t('year.seriesDone')]);
  facts.slice(0, 3).forEach(([value, label], i) => {
    const x = left + i * 300;
    ctx.fillStyle = ink;
    ctx.font = `500 64px ${serif}`;
    ctx.fillText(value, x, 940);
    ctx.fillStyle = ink2;
    ctx.font = `500 30px ${sans}`;
    ctx.fillText(fit(ctx, label, 270), x, 985);
  });

  // Barras por mes
  const max = Math.max(1, ...s.byMonth);
  const barW = 50;
  const gap = (W - left * 2 - barW * 12) / 11;
  s.byMonth.forEach((n, i) => {
    const h = Math.max(8, (n / max) * 190);
    const x = left + i * (barW + gap);
    ctx.fillStyle = n ? accent : line;
    roundRect(ctx, x, 1250 - h, barW, h, 10);
    ctx.fill();
    ctx.fillStyle = ink2;
    ctx.font = `500 26px ${sans}`;
    const m = new Intl.DateTimeFormat(lang, { month: 'narrow' }).format(new Date(2026, i, 1));
    ctx.fillText(m, x + barW / 2 - ctx.measureText(m).width / 2, 1295);
  });

  // Portadas: los mejor calificados o, si no hay notas, los últimos leídos
  const picks: Book[] = (s.topRated.length ? s.topRated : s.books.slice(-3).reverse()).slice(0, 3);
  ctx.fillStyle = ink2;
  ctx.font = `600 32px ${sans}`;
  ctx.fillText(s.topRated.length ? t('year.best') : t('year.latest'), left, 1390);
  const coverW = 250;
  const coverH = 375;
  const images = await Promise.all(
    picks.map((b) => {
      const src = bookCover(b, 'L');
      return src ? loadImage(src) : Promise.resolve(null);
    }),
  );
  picks.forEach((b, i) => {
    const x = left + i * (coverW + 40);
    const y = 1425;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
    roundRect(ctx, x, y, coverW, coverH, 10);
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, coverW, coverH, 10);
    ctx.clip();
    const img = images[i];
    if (img) {
      // Recorte tipo "cover" para no deformar la portada
      const scale = Math.max(coverW / img.width, coverH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, x + (coverW - w) / 2, y + (coverH - h) / 2, w, h);
    } else {
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, coverW, coverH);
      ctx.fillStyle = paper;
      ctx.font = `500 34px ${serif}`;
      ctx.fillText(fit(ctx, b.title, coverW - 40), x + 20, y + 60);
    }
    ctx.restore();
  });

  ctx.fillStyle = ink2;
  ctx.font = `500 30px ${sans}`;
  const author = s.topAuthors[0];
  if (author)
    ctx.fillText(
      fit(ctx, t('year.imageAuthor', { author: author.author }), W - left * 2),
      left,
      1870,
    );

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas vacío'))), 'image/png'),
  );
}
