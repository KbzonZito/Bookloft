/**
 * Separa un script SQL en sentencias y quita los comentarios `--`, respetando los textos entre comillas.
 * El plugin nativo de SQLite procesa mal un comentario al final de una línea cuando recibe varias
 * sentencias juntas: se salta la sentencia siguiente sin dar error. Por eso las migraciones se
 * ejecutan de a una, ya limpias, en todas las plataformas.
 */
export function splitSql(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    if (quote) {
      current += ch;
      // '' dentro de un texto es una comilla escapada, no el cierre
      if (ch === quote && script[i + 1] === quote) current += script[++i];
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
    } else if (ch === '-' && script[i + 1] === '-') {
      while (i < script.length && script[i] !== '\n') i++;
      current += '\n';
    } else if (ch === ';') {
      statements.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  statements.push(current);

  return statements.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
