import { ACHIEVEMENTS_CATALOG } from '~/data/achievementsCatalog';
import {
  TENURE_GIFT_YEARS,
  anniversaryDateIso,
  tenureAnniversaryNotifyKey
} from '~/utils/tenureAnniversary';

/** Канонические типы ленты (иконки в public/activity/icons/). */
export type ProfileActivityKind =
  | 'store'
  | 'talk'
  | 'learning'
  | 'idea'
  | 'achievement'
  | 'promotion'
  | 'mentor'
  | 'practice'
  | 'recognition'
  | 'welcome'
  | 'other';

export type ProfileActivityItem = {
  id: string;
  employee_id?: number;
  platform_user_id?: number | null;
  kind: ProfileActivityKind;
  text: string;
  occurred_at: string;
  source: 'manual' | 'seed' | 'auto';
};

export type ProfileActivityKindOption = { id: ProfileActivityKind; label: string };

const CELEBRATION_KEY = 'vbi-tenure-celebration-v1';
const VACATION_TRAINING_KEY = 'vbi-vacation-training-v1';
const COUPONS_KEY = 'vbi-tenure-coupons-v1';
const ORDERS_KEY = 'vbi-tenure-gift-orders-v1';

export const PROFILE_ACTIVITY_KIND_META: Record<
  ProfileActivityKind,
  { label: string; iconSrc: string; badgeTone: 'lime' | 'purple' }
> = {
  store: {
    label: 'Магазин',
    iconSrc: '/activity/icons/activity-icon-store.png?v=4',
    badgeTone: 'lime'
  },
  talk: {
    label: 'Выступление',
    iconSrc: '/activity/icons/activity-icon-talk.png?v=4',
    badgeTone: 'purple'
  },
  learning: {
    label: 'Обучение',
    iconSrc: '/activity/icons/activity-icon-learning.png?v=4',
    badgeTone: 'lime'
  },
  idea: {
    label: 'Идея',
    iconSrc: '/activity/icons/activity-icon-idea.png?v=4',
    badgeTone: 'lime'
  },
  achievement: {
    label: 'Достижение',
    iconSrc: '/activity/icons/activity-icon-achievement.png?v=4',
    badgeTone: 'purple'
  },
  promotion: {
    label: 'Повышение',
    iconSrc: '/activity/icons/activity-icon-achievement.png?v=4',
    badgeTone: 'purple'
  },
  mentor: {
    label: 'Наставник',
    iconSrc: '/activity/icons/activity-icon-recognition.png?v=4',
    badgeTone: 'lime'
  },
  practice: {
    label: 'Практика',
    iconSrc: '/activity/icons/activity-icon-learning.png?v=4',
    badgeTone: 'purple'
  },
  recognition: {
    label: 'Признание',
    iconSrc: '/activity/icons/activity-icon-recognition.png?v=4',
    badgeTone: 'purple'
  },
  welcome: {
    label: 'Велком',
    iconSrc: '/activity/icons/activity-icon-other.png?v=4',
    badgeTone: 'lime'
  },
  other: {
    label: 'Другое',
    iconSrc: '/activity/icons/activity-icon-other.png?v=4',
    badgeTone: 'lime'
  }
};

const normalizeKind = (raw: string): ProfileActivityKind => {
  const value = String(raw || '').trim();
  if (value in PROFILE_ACTIVITY_KIND_META) return value as ProfileActivityKind;
  if (value === 'conference') return 'talk';
  if (value === 'tenure') return 'achievement';
  if (value === 'custom' || value === 'vacation') return 'other';
  return 'other';
};

const readJson = <T>(key: string, fallback: T): T => {
  if (!import.meta.client) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

/** Стабильный парсинг даты для сортировки ленты (новые сверху). */
const parseOccurredAtMs = (iso: string | undefined): number => {
  const value = String(iso || '').trim();
  if (!value) return 0;
  const d =
    value.length <= 10 && !value.includes('T')
      ? new Date(`${value}T12:00:00`)
      : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
};

const toOccurredIso = (iso: string | undefined): string => {
  const value = String(iso || '').trim();
  if (!value) return new Date(0).toISOString();
  if (value.length <= 10 && !value.includes('T')) return `${value}T12:00:00.000Z`;
  return value;
};

const formatRelativeRu = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'вчера';
  if (diffD < 14) return `${diffD} дн. назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export function useProfileActivity() {
  const { user } = useAuth();
  const { employees, findByUserId, findByUserForAuth } = useEmployees();
  const { ideas } = useIdeasBank();

  const serverItems = useState<ProfileActivityItem[]>('profile-activity-server', () => []);
  const kindOptions = useState<ProfileActivityKindOption[]>('profile-activity-kinds', () =>
    Object.entries(PROFILE_ACTIVITY_KIND_META).map(([id, meta]) => ({
      id: id as ProfileActivityKind,
      label: meta.label
    }))
  );
  const loading = ref(false);
  const error = ref('');

  const buildAutoItems = (employeeId: number, platformUserId: number): ProfileActivityItem[] => {
    const items: ProfileActivityItem[] = [];
    const emp = employees.value.find((row) => row.id === employeeId);

    const celebration = readJson<{ claimed?: string[] }>(CELEBRATION_KEY, {});
    const claimed = Array.isArray(celebration.claimed) ? celebration.claimed : [];
    for (const years of TENURE_GIFT_YEARS) {
      const key = tenureAnniversaryNotifyKey(employeeId, years, 'claim');
      if (!claimed.includes(key)) continue;
      const anniversaryDay =
        emp?.hired_at ? anniversaryDateIso(emp.hired_at, years) : null;
      const anniversaryIso = anniversaryDay ? `${anniversaryDay}T12:00:00.000Z` : undefined;
      items.push({
        id: `auto-tenure-${employeeId}-${years}`,
        employee_id: employeeId,
        platform_user_id: platformUserId,
        kind: 'achievement',
        text: `Отметил юбилей — ${years} лет в компании`,
        occurred_at: toOccurredIso(anniversaryIso),
        source: 'auto'
      });
    }

    const training = readJson<{
      completed?: number[];
      completedAt?: Record<string, string>;
    }>(VACATION_TRAINING_KEY, {});
    if (Array.isArray(training.completed) && training.completed.includes(platformUserId)) {
      const completedAt = training.completedAt?.[String(platformUserId)];
      const ach = ACHIEVEMENTS_CATALOG.find((a) => a.id === 'kalendar-otpuskov');
      items.push({
        id: `auto-learning-${platformUserId}-vacation`,
        employee_id: employeeId,
        platform_user_id: platformUserId,
        kind: 'learning',
        text: ach
          ? `Успешно завершил обучение — «${ach.title}»`
          : 'Успешно завершил обучение по отпускам',
        occurred_at: toOccurredIso(completedAt),
        source: 'auto'
      });
    }

    const coupons = readJson<{
      coupons?: Array<{
        userId: number;
        employeeId: number;
        years: number;
        status: string;
        usedAt?: string;
        createdAt: string;
      }>;
    }>(COUPONS_KEY, {});
    for (const coupon of coupons.coupons || []) {
      if (coupon.userId !== platformUserId && coupon.employeeId !== employeeId) continue;
      if (coupon.status !== 'used') continue;
      items.push({
        id: `auto-coupon-${coupon.employeeId}-${coupon.years}`,
        employee_id: employeeId,
        platform_user_id: platformUserId,
        kind: 'store',
        text: `Активировал юбилейный купон на ${coupon.years} лет`,
        occurred_at: toOccurredIso(coupon.usedAt || coupon.createdAt),
        source: 'auto'
      });
    }

    const orders = readJson<{
      orders?: Array<{
        id: string;
        userId: number;
        employeeId: number;
        years: number;
        createdAt: string;
      }>;
    }>(ORDERS_KEY, {});
    for (const order of orders.orders || []) {
      if (order.userId !== platformUserId && order.employeeId !== employeeId) continue;
      items.push({
        id: `auto-order-${order.id}`,
        employee_id: employeeId,
        platform_user_id: platformUserId,
        kind: 'store',
        text: `Заказал юбилейный набор в магазине (${order.years} лет)`,
        occurred_at: toOccurredIso(order.createdAt),
        source: 'auto'
      });
    }

    for (const idea of ideas.value) {
      if (idea.authorUserId !== platformUserId) continue;
      if (idea.status !== 'done' && idea.status !== 'implementation') continue;
      const when = idea.statusChangedAt || idea.createdAt;
      items.push({
        id: `auto-idea-${idea.id}-${idea.status}`,
        employee_id: employeeId,
        platform_user_id: platformUserId,
        kind: 'idea',
        text:
          idea.status === 'done'
            ? `Идея «${idea.title}» реализована`
            : `Идея «${idea.title}» взята в работу`,
        occurred_at: toOccurredIso(when),
        source: 'auto'
      });
    }

    return items;
  };

  const hydrate = async (opts?: { employeeId?: number; platformUserId?: number }) => {
    loading.value = true;
    error.value = '';
    try {
      const params = new URLSearchParams();
      if (opts?.employeeId) params.set('employee_id', String(opts.employeeId));
      if (opts?.platformUserId) params.set('platform_user_id', String(opts.platformUserId));
      const qs = params.toString();
      const data = await $fetch<{
        items: ProfileActivityItem[];
        kind_options: ProfileActivityKindOption[];
      }>(`/api/profile-activity${qs ? `?${qs}` : ''}`);
      serverItems.value = (data.items || []).map((row) => ({
        ...row,
        kind: normalizeKind(row.kind)
      }));
      if (data.kind_options?.length) kindOptions.value = data.kind_options;
    } catch (e: unknown) {
      const err = e as { data?: { statusMessage?: string }; message?: string };
      error.value = err.data?.statusMessage ?? err.message ?? 'Не удалось загрузить активность';
    } finally {
      loading.value = false;
    }
  };

  const activityFor = (opts: { employeeId?: number | null; platformUserId?: number | null }) => {
    const employeeId = opts.employeeId ?? 0;
    const platformUserId = opts.platformUserId ?? 0;
    const server = serverItems.value.filter((row) => {
      if (employeeId && row.employee_id === employeeId) return true;
      if (platformUserId && row.platform_user_id === platformUserId) return true;
      if (platformUserId && row.employee_id === platformUserId) return true;
      return false;
    });
    const auto =
      employeeId && platformUserId ? buildAutoItems(employeeId, platformUserId) : [];

    const serverTenureYears = new Set(
      server
        .filter((row) => normalizeKind(row.kind) === 'achievement')
        .map((row) => Number(row.text.match(/(\d+)\s+лет/)?.[1] ?? 0))
        .filter((years) => years > 0)
    );
    const hasServerVacationTraining = server.some(
      (row) =>
        normalizeKind(row.kind) === 'learning' &&
        /отпуск/i.test(row.text) &&
        /обучен/i.test(row.text)
    );

    const byId = new Map<string, ProfileActivityItem>();
    for (const row of server) {
      const occurred_at = toOccurredIso(
        row.occurred_at || (row as { created_at?: string }).created_at
      );
      byId.set(row.id, { ...row, occurred_at, kind: normalizeKind(row.kind) });
    }

    for (const row of auto) {
      if (row.kind === 'achievement') {
        const years = Number(row.text.match(/(\d+)\s+лет/)?.[1] ?? 0);
        if (years > 0 && serverTenureYears.has(years)) continue;
      }
      if (row.id.startsWith('auto-learning-') && hasServerVacationTraining) continue;
      if (!byId.has(row.id)) byId.set(row.id, row);
    }

    return [...byId.values()]
      .sort((a, b) => {
        const diff = parseOccurredAtMs(b.occurred_at) - parseOccurredAtMs(a.occurred_at);
        if (diff !== 0) return diff;
        return b.id.localeCompare(a.id);
      })
      .slice(0, 30)
      .map((row) => {
        const kind = normalizeKind(row.kind);
        const meta = PROFILE_ACTIVITY_KIND_META[kind];
        return {
          ...row,
          kind,
          iconSrc: meta.iconSrc,
          kindLabel: meta.label,
          badgeTone: meta.badgeTone,
          timeLabel: formatRelativeRu(row.occurred_at)
        };
      });
  };

  const myActivity = computed(() => {
    const emp = user.value
      ? findByUserForAuth(user.value) ?? findByUserId(user.value.id)
      : null;
    return activityFor({
      employeeId: emp?.id ?? user.value?.id ?? null,
      platformUserId: user.value?.id ?? null
    });
  });

  const createManual = async (input: {
    employee_id: number;
    kind: ProfileActivityKind;
    text: string;
    occurred_at?: string;
  }) => {
    await $fetch('/api/profile-activity', { method: 'POST', body: input });
    await hydrate();
  };

  const removeManual = async (id: string) => {
    await $fetch(`/api/profile-activity/${id}`, { method: 'DELETE' });
    await hydrate();
  };

  const kindLabel = Object.fromEntries(
    Object.entries(PROFILE_ACTIVITY_KIND_META).map(([id, meta]) => [id, meta.label])
  ) as Record<ProfileActivityKind, string>;

  return {
    serverItems,
    kindOptions,
    loading,
    error,
    hydrate,
    activityFor,
    myActivity,
    createManual,
    removeManual,
    kindLabel,
    kindMeta: PROFILE_ACTIVITY_KIND_META
  };
}
