#!/usr/bin/env node
// Genera los íconos de Android (y el de 512 px para Play) desde resources/icon-*.svg.
//   node scripts/icons.mjs
// Usa el Chromium de Playwright para dibujar los SVG (no hace falta otra herramienta).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? '@playwright/test');

const bg = readFileSync('resources/icon-background.svg', 'utf8');
const fg = readFileSync('resources/icon-foreground.svg', 'utf8');
const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** layers: qué capas dibujar; shape: recorte del ícono "legacy" (Android 7 y anteriores) */
const html = (
  size,
  layers,
  shape = 'none',
) => `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;position:relative;overflow:hidden;${
  shape === 'round'
    ? 'border-radius:50%;'
    : shape === 'square'
      ? `border-radius:${size * 0.18}px;`
      : ''
}">${layers.map((l) => `<div style="position:absolute;inset:0">${l}</div>`).join('')}</div>
<style>svg{width:100%;height:100%;display:block}</style></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(file, size, layers, shape) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html(size, layers, shape));
  await page.screenshot({
    path: file,
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

for (const [name, k] of Object.entries(DENSITIES)) {
  const adaptive = Math.round(108 * k); // capas del ícono adaptable: 108 dp
  const legacy = Math.round(48 * k); // ícono clásico: 48 dp
  await render(`${RES}/mipmap-${name}/ic_launcher_foreground.png`, adaptive, [fg]);
  await render(`${RES}/mipmap-${name}/ic_launcher_background.png`, adaptive, [bg]);
  // En el clásico, el contenido se recorta a la zona visible del adaptable (72 de 108)
  const zoom = (svg) => svg.replace('viewBox="0 0 108 108"', 'viewBox="18 18 72 72"');
  await render(`${RES}/mipmap-${name}/ic_launcher.png`, legacy, [zoom(bg), zoom(fg)], 'square');
  await render(
    `${RES}/mipmap-${name}/ic_launcher_round.png`,
    legacy,
    [zoom(bg), zoom(fg)],
    'round',
  );
}
// Para la ficha de Google Play y el README
const zoom = (svg) => svg.replace('viewBox="0 0 108 108"', 'viewBox="18 18 72 72"');
await render('resources/icon-512.png', 512, [zoom(bg), zoom(fg)]);
await browser.close();
console.log('Íconos generados.');

// Pantalla de inicio de Android 11 y anteriores: los mismos tamaños que las splash.png existentes
import { readdirSync } from 'node:fs';
const sizeOf = (file) => {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
const browser2 = await chromium.launch();
const page2 = await browser2.newPage();
for (const dir of readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  const file = `${RES}/${dir}/splash.png`;
  let w, h;
  try {
    [w, h] = sizeOf(file);
  } catch {
    continue;
  }
  const s = Math.round(Math.min(w, h) * 0.42);
  await page2.setViewportSize({ width: w, height: h });
  await page2.setContent(`<!doctype html><body style="margin:0;width:${w}px;height:${h}px;display:grid;place-items:center;background:#0E2340">
    <div style="width:${s}px;height:${s}px">${fg}</div><style>svg{width:100%;height:100%;display:block}</style></body>`);
  await page2.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h } });
}
await browser2.close();
console.log('Splash generadas.');
