/** Minúsculas, sin tildes y con espacios simples: "García  Márquez" → "garcia marquez" */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchText(parts: {
  title: string;
  authors: string[];
  series: string | null;
  tags: string[];
}) {
  return normalize([parts.title, ...parts.authors, parts.series ?? '', ...parts.tags].join(' '));
}
