export const normalizeEmployeeNameKey = (name: string) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');

/** Сопоставить введённое ФИО с одним из допустимых руководителей (точное совпадение с учётом ё). */
export const resolveManagerFromList = (
  value: string,
  options: readonly string[]
): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const key = normalizeEmployeeNameKey(trimmed);
  return options.find((option) => normalizeEmployeeNameKey(option) === key) ?? null;
};

export const splitEmployeeNameLines = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { line1: parts[0] ?? name, line2: null as string | null };
  }
  return { line1: parts[0]!, line2: parts.slice(1).join(' ') };
};
