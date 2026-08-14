/** Разделы, куда может прийти кот оценки (только открытые по launch scope). */
export type PageRatingSection = {
  id: string;
  /** Канонический путь для трекера и API */
  path: string;
  label: string;
};

export const PAGE_RATING_SECTIONS: PageRatingSection[] = [
  { id: 'knowledge', path: '/knowledge', label: 'База знаний' },
  { id: 'vacations', path: '/vacations', label: 'Отпуска' },
  { id: 'ideas', path: '/ideas', label: 'Банк идей' },
  { id: 'vpn', path: '/vpn', label: 'VPN' },
  { id: 'profile', path: '/profile', label: 'Профиль' }
];

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
  for (const section of PAGE_RATING_SECTIONS) {
    if (path === section.path || path.startsWith(`${section.path}/`)) {
      return section;
    }
  }
  return null;
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
