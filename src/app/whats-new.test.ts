import { describe, expect, it } from 'vitest';
import { changesSince, compareVersions, parseChangelog } from './whats-new';

const RAW = `# Cambios

## [Unreleased]

- Algo sin publicar

## [0.8.0] - 2026-11-05

- Estantería nueva
- Una línea larga
  que sigue aquí

## [0.7.0] - 2026-11-04

- Resumen del año

## [0.6.0] - 2026-11-04

- ¿Qué leo ahora?
`;

describe('novedades', () => {
  it('lee las secciones publicadas, sin lo que no se ha publicado', () => {
    const s = parseChangelog(RAW);
    expect(s.map((x) => x.version)).toEqual(['0.8.0', '0.7.0', '0.6.0']);
    expect(s[0].items).toEqual(['Estantería nueva', 'Una línea larga que sigue aquí']);
  });

  it('muestra lo que hay entre la versión vista y la actual', () => {
    expect(changesSince(RAW, '0.6.0', '0.8.0').map((s) => s.version)).toEqual(['0.8.0', '0.7.0']);
    expect(changesSince(RAW, '0.8.0', '0.8.0')).toEqual([]);
    expect(changesSince(RAW, null, '0.8.0').map((s) => s.version)).toEqual(['0.8.0']);
    expect(compareVersions('0.10.0', '0.9.1')).toBeGreaterThan(0);
  });
});

describe('novedades en dos idiomas', () => {
  it('el CHANGELOG en español y en inglés tienen las mismas versiones y viñetas', async () => {
    const { readFileSync } = await import('node:fs');
    const es = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    const en = parseChangelog(readFileSync('CHANGELOG.en.md', 'utf8'));
    expect(en.map((s) => s.version)).toEqual(es.map((s) => s.version));
    expect(en.map((s) => s.items.length)).toEqual(es.map((s) => s.items.length));
  });
});
