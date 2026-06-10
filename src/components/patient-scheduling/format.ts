const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function formatSpecialty(value?: string | null): string {
  const raw = value?.trim();
  if (!raw) return 'Clínica geral';

  return raw
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1);
    })
    .join(' ');
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}
