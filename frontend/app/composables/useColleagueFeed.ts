import { todayIso } from '~/utils/vacationCalendar';
import type { ProfileActivityKind } from '~/composables/useProfileActivity';

export type ColleagueFeedItemType =
  | 'gift'
  | 'achievement'
  | 'task'
  | 'welcome'
  | 'vacation'
  | 'event'
  | 'recognition';

export type ColleagueFeedItem = {
  id: string;
  type: ColleagueFeedItemType;
  text: string;
  time: string;
  icon?: string;
  occurred_at?: string;
};

const feedIconByType: Record<ColleagueFeedItemType, string> = {
  gift: '🎁',
  achievement: '🏆',
  task: '✅',
  welcome: '👋',
  vacation: '🏖️',
  event: '🎤',
  recognition: '⭐'
};

const kindToFeedType = (kind: ProfileActivityKind): ColleagueFeedItemType | null => {
  if (kind === 'achievement' || kind === 'promotion') return 'achievement';
  if (kind === 'recognition') return 'recognition';
  if (kind === 'talk') return 'event';
  if (kind === 'welcome') return 'welcome';
  if (kind === 'learning' || kind === 'mentor' || kind === 'practice') return 'event';
  if (kind === 'store') return 'gift';
  return null;
};

const formatRelativeRu = (iso: string): string => {
  try {
    const then = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso).getTime();
    const diffMin = Math.round((Date.now() - then) / 60000);
    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH} ч назад`;
    const diffD = Math.round(diffH / 24);
    if (diffD === 1) return 'вчера';
    if (diffD < 7) return `${diffD} дн. назад`;
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(
      new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso)
    );
  } catch {
    return iso;
  }
};

/**
 * Новости коллег: из серверной ленты активности (без демо на бою).
 * Будущие даты (до reveal) не показываем.
 */
export function useColleagueFeed() {
  const { serverItems, hydrate, loading } = useProfileActivity();
  const { isProduction } = useAppEnv();
  const hydrated = useState('colleague-feed-hydrated', () => false);

  const ensureHydrated = async () => {
    if (hydrated.value) return;
    await hydrate().catch(() => {});
    hydrated.value = true;
  };

  if (import.meta.client) {
    void ensureHydrated();
  }

  const items = computed<ColleagueFeedItem[]>(() => {
    const today = todayIso();
    const fromServer = serverItems.value
      .filter((row) => {
        const day = String(row.occurred_at || '').slice(0, 10);
        return day && day <= today;
      })
      .map((row) => {
        const type = kindToFeedType(row.kind);
        if (!type) return null;
        return {
          id: row.id,
          type,
          text: row.text,
          time: formatRelativeRu(row.occurred_at),
          icon: feedIconByType[type],
          occurred_at: row.occurred_at
        } satisfies ColleagueFeedItem;
      })
      .filter((row): row is ColleagueFeedItem => Boolean(row))
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
      .slice(0, 12);

    if (fromServer.length > 0 || isProduction.value) return fromServer;

    // localhost / staging: пустой placeholder, пока нет реальных событий
    return [
      {
        id: 'feed-empty',
        type: 'achievement' as const,
        text: 'Здесь появятся новости коллег — ачивки, выступления, велком.',
        time: 'скоро',
        icon: '✨'
      }
    ];
  });

  return { items, loading, refresh: ensureHydrated };
}
