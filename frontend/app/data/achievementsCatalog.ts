import { VACATION_TRAINING_ACHIEVEMENT } from '~/data/vacationTrainingQuest';

/** Секции в оверлее «Все ачивки». */
export type AchievementSection =
  | 'tenure-career'
  | 'vacation'
  | 'talks'
  | 'learning'
  | 'store'
  | 'leadership'
  | 'corporate-culture';

export const ACHIEVEMENT_SECTION_META: Record<
  AchievementSection,
  { title: string; order: number }
> = {
  'tenure-career': { title: 'Стаж и карьера', order: 1 },
  vacation: { title: 'Отпуск', order: 2 },
  talks: { title: 'Выступления и кейсы', order: 3 },
  learning: { title: 'Обучение', order: 4 },
  store: { title: 'Магазин', order: 5 },
  leadership: { title: 'Лидерство и инициатива', order: 6 },
  'corporate-culture': { title: 'Корпоративная культура', order: 7 }
};

export const ACHIEVEMENT_SECTION_ORDER = (
  Object.entries(ACHIEVEMENT_SECTION_META) as [AchievementSection, { order: number }][]
)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([id]) => id);

export type AchievementDef = {
  id: string;
  title: string;
  subtitle?: string;
  imageSrc?: string;
  emoji?: string;
  section: AchievementSection;
  /** Порядок внутри секции. */
  sortOrder: number;
  /** Не показывать в бейджах под ФИО (может быть в превью блока «Ачивки»). */
  hideFromHeroBadges?: boolean;
  /** В превью — круглый PNG без квадратной рамки. */
  previewRound?: boolean;
  /** Закрепить первой в превью блока «Ачивки». */
  pinPreviewFirst?: boolean;
};

type TierDef = {
  id: string;
  count: number;
  title: string;
  subtitle: string;
  emoji?: string;
};

const tierSeries = (
  prefix: string,
  items: TierDef[],
  section: AchievementSection,
  baseOrder: number
): AchievementDef[] =>
  items.map((item, index) => ({
    id: `${prefix}-${item.count}`,
    title: item.title,
    subtitle: item.subtitle,
    emoji: item.emoji,
    section,
    sortOrder: baseOrder + index
  }));

/** Каталог ачивок: выдача подключается по мере появления источников данных. */
export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  // —— Стаж и карьера ——
  {
    id: 'tenure-1y',
    title: '1 год с VBI',
    subtitle: 'Первый юбилей',
    emoji: '1',
    section: 'tenure-career',
    sortOrder: 10
  },
  {
    id: 'tenure-5y',
    title: '5 лет с VBI',
    subtitle: 'Юбилей стажа и купон на набор',
    emoji: '5',
    section: 'tenure-career',
    sortOrder: 11
  },
  {
    id: 'tenure-10y',
    title: '10 лет с VBI',
    subtitle: 'Юбилей стажа и купон на набор',
    emoji: '10',
    section: 'tenure-career',
    sortOrder: 12
  },
  {
    id: 'tenure-15y',
    title: '15 лет с VBI',
    subtitle: 'Юбилей стажа и купон на набор',
    emoji: '15',
    section: 'tenure-career',
    sortOrder: 13
  },
  ...tierSeries(
    'promo',
    [
      { id: '1', count: 1, title: 'Повышение', subtitle: 'Получил повышение в должности', emoji: '⬆️' },
      { id: '2', count: 2, title: '2 повышения', subtitle: 'Два повышения за карьеру в VBI', emoji: '⬆️' },
      { id: '3', count: 3, title: '3 повышения', subtitle: 'Три повышения за карьеру в VBI', emoji: '⬆️' }
    ],
    'tenure-career',
    20
  ),

  // —— Отпуск ——
  {
    id: 'vacation-full-28',
    title: 'Отдых без остатка',
    subtitle: 'Использовал все 28 дней отпуска за год',
    emoji: '🌴',
    section: 'vacation',
    sortOrder: 30
  },

  // —— Выступления и публикации ——
  {
    id: 'talk-first',
    title: 'Первое выступление',
    subtitle: 'Дебют на внутренней или внешней сцене',
    emoji: '🎤',
    section: 'talks',
    sortOrder: 60
  },
  ...tierSeries(
    'talk-year',
    [
      { id: '2', count: 2, title: '2 выступления за год', subtitle: 'Два доклада за календарный год', emoji: '🎤' },
      { id: '3', count: 3, title: '3 выступления за год', subtitle: 'Три доклада за календарный год', emoji: '🎤' },
      { id: '5', count: 5, title: '5 выступлений за год', subtitle: 'Пять докладов за календарный год', emoji: '🎤' }
    ],
    'talks',
    61
  ),
  ...tierSeries(
    'talk-total',
    [
      { id: '5', count: 5, title: '5 выступлений всего', subtitle: 'Пять докладов за всё время', emoji: '📢' },
      { id: '10', count: 10, title: '10 выступлений всего', subtitle: 'Десять докладов за всё время', emoji: '📢' },
      { id: '20', count: 20, title: '20 выступлений всего', subtitle: 'Двадцать докладов за всё время', emoji: '📢' }
    ],
    'talks',
    65
  ),
  {
    id: 'journal-publish',
    title: 'Автор публикации',
    subtitle: 'Опубликовал статью или кейс в журнале',
    emoji: '✍️',
    section: 'talks',
    sortOrder: 68
  },
  {
    id: 'journal-famous',
    title: 'Известная публикация',
    subtitle: 'Статья или кейс получил широкий отклик',
    emoji: '📰',
    section: 'talks',
    sortOrder: 69
  },

  // —— Обучение ——
  {
    id: 'learning-1',
    title: 'Прошёл обучение',
    subtitle: 'Завершил первый курс',
    emoji: '📚',
    section: 'learning',
    sortOrder: 70
  },
  ...tierSeries(
    'learning',
    [
      { id: '5', count: 5, title: '5 курсов', subtitle: 'Пять завершённых курсов обучения', emoji: '📚' },
      { id: '10', count: 10, title: '10 курсов', subtitle: 'Десять завершённых курсов обучения', emoji: '📚' }
    ],
    'learning',
    71
  ),
  {
    id: VACATION_TRAINING_ACHIEVEMENT.id,
    title: VACATION_TRAINING_ACHIEVEMENT.title,
    subtitle: VACATION_TRAINING_ACHIEVEMENT.subtitle,
    imageSrc: VACATION_TRAINING_ACHIEVEMENT.imageSrc,
    section: 'learning',
    sortOrder: 1,
    hideFromHeroBadges: true,
    previewRound: true,
    pinPreviewFirst: true
  },

  // —— Магазин (только авто-счёт) ——
  ...tierSeries(
    'store',
    [
      { id: '5', count: 5, title: '5 покупок', subtitle: 'Пять товаров в магазине Vibe', emoji: '🛍️' },
      { id: '10', count: 10, title: '10 покупок', subtitle: 'Десять товаров в магазине Vibe', emoji: '🛍️' },
      { id: '15', count: 15, title: '15 покупок', subtitle: 'Пятнадцать товаров в магазине Vibe', emoji: '🛍️' }
    ],
    'store',
    90
  ),

  // —— Лидерство и инициатива ——
  ...tierSeries(
    'idea-done',
    [
      {
        id: '1',
        count: 1,
        title: 'Идея в жизни',
        subtitle: 'Предложил улучшение — и довёл до результата',
        emoji: '💡'
      },
      { id: '5', count: 5, title: '5 идей в жизни', subtitle: 'Пять реализованных инициатив', emoji: '✨' },
      { id: '10', count: 10, title: '10 идей в жизни', subtitle: 'Десять реализованных инициатив', emoji: '🚀' },
      { id: '20', count: 20, title: '20 идей в жизни', subtitle: 'Двадцать реализованных инициатив', emoji: '🏆' },
      { id: '50', count: 50, title: '50 идей в жизни', subtitle: 'Пятьдесят реализованных инициатив', emoji: '👑' },
      {
        id: '100',
        count: 100,
        title: '100 идей в жизни',
        subtitle: 'Сто реализованных инициатив',
        emoji: '💎'
      }
    ],
    'leadership',
    100
  ),
  ...tierSeries(
    'mentor',
    [
      { id: '3', count: 3, title: 'Наставник троих', subtitle: 'Был наставником трёх сотрудников', emoji: '🤝' },
      { id: '4', count: 4, title: 'Наставник четверых', subtitle: 'Был наставником четырёх сотрудников', emoji: '🤝' },
      { id: '5', count: 5, title: 'Наставник пятерых', subtitle: 'Был наставником пяти сотрудников', emoji: '🤝' },
      { id: '6', count: 6, title: 'Наставник шестерых', subtitle: 'Был наставником шести сотрудников', emoji: '🤝' }
    ],
    'leadership',
    110
  ),
  ...tierSeries(
    'practice-lead',
    [
      { id: '1', count: 1, title: 'Руководитель практики', subtitle: 'Первый раз возглавил практику', emoji: '🎓' },
      { id: '3', count: 3, title: '3 практики', subtitle: 'Три раза был руководителем практики', emoji: '🎓' },
      { id: '5', count: 5, title: '5 практик', subtitle: 'Пять раз был руководителем практики', emoji: '🎓' },
      { id: '6', count: 6, title: '6 практик', subtitle: 'Шесть раз был руководителем практики', emoji: '🎓' },
      { id: '7', count: 7, title: '7 практик', subtitle: 'Семь раз был руководителем практики', emoji: '🎓' },
      { id: '8', count: 8, title: '8 практик', subtitle: 'Восемь раз был руководителем практики', emoji: '🎓' }
    ],
    'leadership',
    120
  ),

  // —— Лучший специалист продаж (выбор админа 29-го; reveal — первый рабочий день след. месяца) ——
  ...([
    { count: 1, title: 'Лучший специалист продаж', subtitle: 'Перевыполнил план продаж сильнее всех в месяце' },
    { count: 2, title: 'Лучший специалист продаж ×2', subtitle: 'Признан лучшим в ОП два раза' },
    { count: 3, title: 'Лучший специалист продаж ×3', subtitle: 'Признан лучшим в ОП три раза' },
    { count: 4, title: 'Лучший специалист продаж ×4', subtitle: 'Признан лучшим в ОП четыре раза' },
    { count: 5, title: 'Лучший специалист продаж ×5', subtitle: 'Признан лучшим в ОП пять раз' }
  ] as const).map((item, index) => ({
    id: `sales-best-${item.count}`,
    title: item.title,
    subtitle: item.subtitle,
    imageSrc: '/achievements/sales-best.png',
    section: 'leadership' as const,
    sortOrder: 130 + index
  })),

  // —— Корпоративная культура ——
  {
    id: 'pit-stop-14',
    title: 'Легенда трека — 14',
    subtitle: 'Топ-3 лучшего круга Pit Stop 14',
    imageSrc: '/achievements/pit-stop-14.png',
    section: 'corporate-culture',
    sortOrder: 10
  }
];

export type AchievementCatalogItem = AchievementDef & { earned: boolean };

export type AchievementCatalogSection = {
  section: AchievementSection;
  title: string;
  items: AchievementCatalogItem[];
  earnedCount: number;
};

export const achievementById = (id: string): AchievementDef | undefined =>
  ACHIEVEMENTS_CATALOG.find((a) => a.id === id);

export const PROFILE_ACHIEVEMENT_SLOTS = 5;

export const isHiddenFromHeroBadges = (id: string): boolean =>
  achievementById(id)?.hideFromHeroBadges === true;

/** Пороговые ачивки: выдать все, чей числовой суффикс ≤ фактическому значению. */
export const tierAchievementIds = (prefix: string, count: number): string[] =>
  ACHIEVEMENTS_CATALOG.filter((a) => {
    if (!a.id.startsWith(`${prefix}-`)) return false;
    const suffix = a.id.slice(prefix.length + 1);
    const n = Number(suffix);
    return Number.isFinite(n) && n <= count;
  }).map((a) => a.id);

export const groupAchievementsBySection = (
  items: AchievementCatalogItem[]
): AchievementCatalogSection[] => {
  const bySection = new Map<AchievementSection, AchievementCatalogItem[]>();
  for (const item of items) {
    const list = bySection.get(item.section) ?? [];
    list.push(item);
    bySection.set(item.section, list);
  }

  return ACHIEVEMENT_SECTION_ORDER.map((section) => {
    const sectionItems = (bySection.get(section) ?? []).sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
    return {
      section,
      title: ACHIEVEMENT_SECTION_META[section].title,
      items: sectionItems,
      earnedCount: sectionItems.filter((row) => row.earned).length
    };
  }).filter((group) => group.items.length > 0);
};

/**
 * Витрина для сотрудника: только полученные ачивки, разделы без полученных
 * не возвращаются вовсе (без заголовка). Общих счётчиков «N из M» нет.
 */
export const earnedAchievementSections = (
  items: AchievementCatalogItem[]
): AchievementCatalogSection[] =>
  groupAchievementsBySection(items.filter((item) => item.earned));
