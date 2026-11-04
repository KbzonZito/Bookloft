// Textos sin usar: cada clave tiene que aparecer en el código, salvo las que se arman con un prefijo
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translate } from './i18n';

const DYNAMIC = [
  'shelf.',
  'status.',
  'ai.error.',
  'empty.',
  'priority.',
  'sort.',
  'tab.',
  'theme.',
  'vault.',
  'lang.',
];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/i18n\.tsx$|\.test\.ts$/.test(e.name)
        ? [readFileSync(join(dir, e.name), 'utf8')]
        : [],
  );
}

describe('textos', () => {
  it('no hay claves sin usar', () => {
    const i18n = readFileSync(join(__dirname, 'i18n.tsx'), 'utf8');
    const keys = [...i18n.slice(0, i18n.indexOf('const en')).matchAll(/^ {2}'([^']+)':/gm)].map(
      (m) => m[1],
    );
    expect(keys.length).toBeGreaterThan(100);
    const code = sources(__dirname).join('\n');
    const unused = keys.filter(
      (k) => !DYNAMIC.some((p) => k.startsWith(p)) && !code.includes(`'${k}'`),
    );
    expect(unused).toEqual([]);
  });

  it('las variables se reemplazan', () => {
    expect(translate('es', 'tools.imported', { added: 2, skipped: 1 })).toBe(
      'Agregué 2 libros · 1 ya estaban',
    );
  });
});
