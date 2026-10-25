/**
 * Подсветка пункта нижнего меню (мобильный док).
 * Правило: пункт активен только если текущий путь — его раздел.
 * Если раздела нет в доке — не подсвечиваем ничего (без «первого по умолчанию»).
 */

/** Пункты, которые подсвечиваются только на точном совпадении (корни разделов). */
const EXACT_ONLY = new Set(['/', '/admin']);

/** Дополнительные пути, которые относятся к пункту дока. */
const ALIASES: Record<string, string[]> = {
  // Кошелёк открывается из Магазина
  '/store': ['/wallet']
};

const matchesPrefix = (path: string, base: string) =>
  path === base || path.startsWith(`${base}/`);

export const normalizeDockPath = (path: string) => {
  const clean = (path || '/').split(/[?#]/)[0] || '/';
  return clean.length > 1 ? clean.replace(/\/+$/, '') || '/' : clean;
};

export const isDockItemActive = (to: string, currentPath: string): boolean => {
  const path = normalizeDockPath(currentPath);
  if (EXACT_ONLY.has(to)) return path === to;
  if (matchesPrefix(path, to)) return true;
  return (ALIASES[to] ?? []).some((alias) => matchesPrefix(path, alias));
};

/** Активный пункт дока или null, если текущего раздела в доке нет. */
export const findActiveDockItem = <T extends { to: string }>(
  items: readonly T[],
  currentPath: string
): T | null => items.find((item) => isDockItemActive(item.to, currentPath)) ?? null;
