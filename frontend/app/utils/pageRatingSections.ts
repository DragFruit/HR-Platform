/** Разделы, куда может прийти кот оценки (только открытые по launch scope). */
export type PageRatingSection = {
  id: string;
  /** Канонический путь для трекера и API */
  path: string;
  label: string;
};

/**
 * Известные разделы (dwell и подписи).
 * Остальные открытые пути (кроме ивентов) подхватываются в resolvePageRatingSection.
 */
export const PAGE_RATING_SECTIONS: PageRatingSection[] = [
  { id: 'knowledge', path: '/knowledge', label: 'База знаний' },
  { id: 'vacations', path: '/vacations', label: 'График отпусков' },
  { id: 'ideas', path: '/ideas', label: 'Банк идей' },
  { id: 'notifications', path: '/notifications', label: 'Уведомления' },
  { id: 'organization', path: '/organization', label: 'Структура' },
  { id: 'profile', path: '/profile', label: 'Профиль' },
  { id: 'vpn', path: '/vpn', label: 'VPN' },
  { id: 'admin-vacations', path: '/admin/vacations', label: 'Админ · отпуска' },
  { id: 'admin-notifications', path: '/admin/notifications', label: 'Админ · уведомления' },
  { id: 'admin-ideas', path: '/admin/ideas', label: 'Админ · банк идей' },
  { id: 'admin-knowledge', path: '/admin/knowledge', label: 'Админ · база знаний' },
  { id: 'admin-organization', path: '/admin/organization', label: 'Админ · структура' },
  { id: 'admin-employees', path: '/admin/employees', label: 'Админ · сотрудники' }
];

/** Ивенты (`/event/*`) — кот не показывается. */
export function isPageRatingExcludedPath(path: string): boolean {
  const p = path.split('?')[0] || '/';
  if (p === '/event' || p.startsWith('/event/')) return true;
  return false;
}

export const PAGE_RATING_PERIOD_DAYS = 60;
export const PAGE_RATING_DWELL_MS = 60 * 60 * 1000; // 1 час суммарно
/** Старт «окон» для рассинхрона дней между пользователями */
export const PAGE_RATING_EPOCH_MS = Date.UTC(2026, 0, 1);

export function pageRatingLabel(path: string): string {
  const hit = PAGE_RATING_SECTIONS.find((s) => s.path === path);
  return hit?.label || path;
}

export function resolvePageRatingSection(routePath: string): PageRatingSection | null {
  const path = routePath.split('?')[0] || '/';
  if (isPageRatingExcludedPath(path)) return null;

  // Длинные пути первыми (/admin/vacations раньше /admin)
  const ranked = [...PAGE_RATING_SECTIONS].sort((a, b) => b.path.length - a.path.length);
  for (const section of ranked) {
    if (path === section.path || path.startsWith(`${section.path}/`)) {
      return section;
    }
  }

  // Остальные открытые страницы: /foo или /admin/foo
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return null;
  const canonical =
    parts[0] === 'admin' && parts[1] ? `/${parts[0]}/${parts[1]}` : `/${parts[0]}`;
  if (isPageRatingExcludedPath(canonical)) return null;
  return {
    id: canonical.replace(/^\//, '').replace(/\//g, '-'),
    path: canonical,
    label: pageRatingLabel(canonical)
  };
}

/** Стабильный день внутри 60-дневного окна (0…59), чтобы не всем разом. */
export function pageRatingDayOffset(userId: number): number {
  let h = userId | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return Math.abs(h) % PAGE_RATING_PERIOD_DAYS;
}

export function pageRatingPeriodIndex(nowMs = Date.now()): number {
  const periodMs = PAGE_RATING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return Math.floor((nowMs - PAGE_RATING_EPOCH_MS) / periodMs);
}

export function pageRatingEligibleFromMs(userId: number, periodIndex: number): number {
  const periodMs = PAGE_RATING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  return PAGE_RATING_EPOCH_MS + periodIndex * periodMs + pageRatingDayOffset(userId) * dayMs;
}
