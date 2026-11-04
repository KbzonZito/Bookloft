// Novedades tras actualizar: las secciones del CHANGELOG entre la versión que se vio la última vez y
// la actual. El CHANGELOG viaja dentro de la app (es corto) y ya está escrito para quien la usa.
export interface ChangelogSection {
  version: string;
  date: string | null;
  items: string[];
}

export function parseChangelog(raw: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  for (const line of raw.split('\n')) {
    const head = line.match(/^## \[(\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?/);
    if (head) {
      current = { version: head[1], date: head[2] ?? null, items: [] };
      sections.push(current);
    } else if (line.startsWith('## ')) {
      current = null; // [Unreleased]
    } else if (current && line.startsWith('- ')) current.items.push(line.slice(2).trim());
    else if (current && /^\s+\S/.test(line) && current.items.length) {
      current.items[current.items.length - 1] += ` ${line.trim()}`;
    }
  }
  return sections;
}

const parts = (v: string) => v.split('.').map(Number);
export function compareVersions(a: string, b: string) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/**
 * Lo nuevo para mostrar. Sin versión vista guardada (se actualizó desde una versión anterior a este
 * aviso), solo la sección de la versión actual.
 */
export function changesSince(raw: string, seen: string | null, current: string) {
  return parseChangelog(raw).filter(
    (s) =>
      compareVersions(s.version, current) <= 0 &&
      (seen ? compareVersions(s.version, seen) > 0 : s.version === current),
  );
}

/** "**Ajustes → Organizar**" y similares: el CHANGELOG usa muy poco Markdown */
export const plain = (item: string) => item.replace(/\*\*|`/g, '');
