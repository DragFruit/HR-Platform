export const normalizeEmployeeNameKey = (name: string) =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');

/**
 * Фамилия + имя без отчества для UI (карточка, профиль, календари, идеи…).
 * Полное ФИО — только в админке и в заявлении на отпуск.
 * Три и более слов → первые два; иначе как есть.
 */
export const formatEmployeeShortName = (name: string): string => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 3) return `${parts[0]} ${parts[1]}`;
  return parts.join(' ');
};

/** Сопоставление ФИО: точное или по фамилии+имени (заявки/сессия vs полное ФИО в справочнике). */
export const employeeNamesMatch = (a: string, b: string): boolean => {
  const left = normalizeEmployeeNameKey(a);
  const right = normalizeEmployeeNameKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return (
    normalizeEmployeeNameKey(formatEmployeeShortName(a)) ===
    normalizeEmployeeNameKey(formatEmployeeShortName(b))
  );
};

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
  const parts = formatEmployeeShortName(name).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { line1: parts[0] ?? name, line2: null as string | null };
  }
  return { line1: parts[0]!, line2: parts.slice(1).join(' ') };
};
