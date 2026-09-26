import type { PitStopCheckpointDef, PitStopCheckpointId } from './types';

/** Все моменты — календарь Europe/Moscow. */
export const PIT_STOP_TZ = 'Europe/Moscow';

export const PIT_STOP_CHECKPOINTS: PitStopCheckpointDef[] = [
  {
    id: 1,
    slug: 'cipher',
    title: 'Чек-поинт 1: Ключ от гаража',
    unlockDate: '2026-09-28',
    kind: 'pair'
  },
  {
    id: 2,
    slug: 'assembly',
    title: 'Чек-поинт 2: Скоростной Пит-стоп',
    unlockDate: '2026-09-29',
    kind: 'pair'
  },
  {
    id: 3,
    slug: 'ignition',
    title: 'Чек-поинт 3: Синхронное зажигание',
    unlockDate: '2026-10-01',
    kind: 'pair'
  },
  {
    id: 4,
    slug: 'blind-pilot',
    title: 'Чек-поинт 4: Слепой пилот',
    unlockDate: '2026-10-02',
    kind: 'pair'
  },
  {
    id: 5,
    slug: 'coffee',
    title: 'Чек-поинт 5: Дозаправка пилотов',
    unlockDate: '2026-10-05',
    kind: 'media'
  },
  {
    id: 6,
    slug: 'easter',
    title: 'Чек-поинт 6: Пасхалка на трассе',
    unlockDate: '2026-10-06',
    kind: 'solo'
  },
  {
    id: 7,
    slug: 'puzzle',
    title: 'Чек-поинт 7: Общий пазл',
    unlockDate: '2026-10-08',
    kind: 'pair'
  },
  {
    id: 8,
    slug: 'checkered',
    title: 'Чек-поинт 8: Клетчатый флаг',
    unlockDate: '2026-10-09',
    kind: 'finale'
  }
];

/** 10 октября 03:00 МСК — стоп игры */
export const PIT_STOP_STOP_AT = '2026-10-10T03:00:00+03:00';

/** 10 октября 10:00 МСК — награды */
export const PIT_STOP_REWARDS_AT = '2026-10-10T10:00:00+03:00';

export const PIT_STOP_BUFFER_DATES = ['2026-09-30', '2026-10-03', '2026-10-04', '2026-10-07'] as const;

export function pitStopCheckpointById(id: PitStopCheckpointId): PitStopCheckpointDef {
  const found = PIT_STOP_CHECKPOINTS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown pit-stop checkpoint ${id}`);
  return found;
}

/** Локальная календарная дата YYYY-MM-DD в МСК. */
export function moscowDateIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PIT_STOP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/** Unix ms для 09:00 МСК в указанный календарный день. */
export function moscowNineAmMs(dateIso: string): number {
  return Date.parse(`${dateIso}T09:00:00+03:00`);
}

export function isPitStopGameStopped(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(PIT_STOP_STOP_AT);
}

export function isPitStopRewardsDue(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(PIT_STOP_REWARDS_AT);
}

/** Стейдж / явный флаг — все точки открыты для прогона игр (на бою никогда). */
export function isPitStopTestUnlockAll(): boolean {
  if (typeof process !== 'undefined') {
    if (process.env.PIT_STOP_DEV_UNLOCK === '1') return true;
    if (process.env.NUXT_PUBLIC_PIT_STOP_DEV_UNLOCK === '1') return true;
    const env = process.env.NUXT_PUBLIC_APP_ENV || '';
    if (env === 'staging' || env === 'development') return true;
  }
  try {
    const appEnv = String(useRuntimeConfig().public.appEnv || '');
    if (appEnv === 'staging' || appEnv === 'development') return true;
  } catch {
    /* вне Nuxt-контекста */
  }
  return false;
}

export function isCheckpointUnlocked(id: PitStopCheckpointId, now: Date = new Date()): boolean {
  if (isPitStopGameStopped(now)) return false;
  if (isPitStopTestUnlockAll()) return true;
  const def = pitStopCheckpointById(id);
  return now.getTime() >= moscowNineAmMs(def.unlockDate);
}

export type HubCheckpointView = {
  id: PitStopCheckpointId;
  title: string;
  unlockDate: string;
  unlocked: boolean;
  lockedLabel: string;
};

export function buildHubTimeline(now: Date = new Date()): HubCheckpointView[] {
  return PIT_STOP_CHECKPOINTS.map((c) => {
    const unlocked = isCheckpointUnlocked(c.id, now);
    return {
      id: c.id,
      title: c.title,
      unlockDate: c.unlockDate,
      unlocked,
      lockedLabel: unlocked ? '' : `Откроется ${formatUnlockRu(c.unlockDate)} в 09:00`
    };
  });
}

function formatUnlockRu(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const months = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря'
  ];
  return `${d} ${months[(m || 1) - 1]}${y !== 2026 ? ` ${y}` : ''}`;
}
