// Опросы — Phase 1 (MVP). Типы используются и на фронте, и на сервере
// (server/utils/surveysStore.ts, server/utils/surveyResponsesStore.ts), поэтому
// здесь только типы + чистые хелперы, без доступа к DOM/composables на верхнем уровне.

export type SurveyStatus = 'draft' | 'published' | 'closed';

export type SurveyQuestionType =
  | 'info' // Информационный текст
  | 'single' // Выбор одного
  | 'multi' // Выбор нескольких
  | 'yesno' // Да/Нет
  | 'smiley' // Смайл-рейтинг (5 точек)
  | 'nps' // NPS 0-10
  | 'scale' // Шкала 1..N
  | 'text_short' // Открытый текст — короткий
  | 'text_long'; // Открытый текст — длинный

export const SURVEY_QUESTION_TYPES: SurveyQuestionType[] = [
  'info',
  'single',
  'multi',
  'yesno',
  'smiley',
  'nps',
  'scale',
  'text_short',
  'text_long'
];

export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  info: 'Информационный текст',
  single: 'Выбор одного',
  multi: 'Выбор нескольких',
  yesno: 'Да / Нет',
  smiley: 'Смайл-рейтинг',
  nps: 'NPS (0–10)',
  scale: 'Шкала',
  text_short: 'Открытый текст — короткий',
  text_long: 'Открытый текст — длинный'
};

/** Вопросы, у которых есть ответ (всё кроме информационного блока). */
export const ANSWERABLE_TYPES: SurveyQuestionType[] = SURVEY_QUESTION_TYPES.filter(
  (t) => t !== 'info'
);

/** Вопросы с распределением ответов (для гистограммы в результатах). */
export const DISTRIBUTION_TYPES: SurveyQuestionType[] = [
  'single',
  'multi',
  'yesno',
  'smiley',
  'nps',
  'scale'
];

export const SMILEY_LABELS = ['Очень плохо', 'Плохо', 'Нормально', 'Хорошо', 'Отлично'] as const;

/** Базовая палитра эмодзи для смайл-рейтинга (от 5 точек); для меньшего числа точек берём подмножество. */
export const SMILEY_EMOJI_BASE = ['😞', '🙁', '😐', '🙂', '😄'];

/** Эмодзи для точки idx (0-based) при общем количестве точек count. */
export function smileyEmojiAt(idx: number, count: number): string {
  if (count <= 1) return SMILEY_EMOJI_BASE[2];
  if (count === SMILEY_EMOJI_BASE.length) return SMILEY_EMOJI_BASE[idx] ?? SMILEY_EMOJI_BASE[0];
  const pos = Math.round((idx * (SMILEY_EMOJI_BASE.length - 1)) / (count - 1));
  return SMILEY_EMOJI_BASE[pos] ?? SMILEY_EMOJI_BASE[0];
}

/** Разрешённое число точек смайл-рейтинга (MVP: 3 или 5). */
export const SMILEY_POINT_COUNTS = [3, 5] as const;

/**
 * Пересчитать подписи смайлов при смене количества точек — не теряем текст там, где
 * позиции логически совпадают (например, 5→3 берёт крайние и середину).
 */
export function resizeSmileyLabels(current: string[], newCount: number): string[] {
  const defaults = [...SMILEY_LABELS];
  const src = current.length ? current : defaults;
  const result: string[] = [];
  for (let i = 0; i < newCount; i += 1) {
    const oldIdx = src.length > 1 ? Math.round((i * (src.length - 1)) / (newCount - 1)) : 0;
    result.push(src[oldIdx] || defaults[Math.min(i, defaults.length - 1)] || `Отметка ${i + 1}`);
  }
  return result;
}

export const NPS_DEFAULT_LOW_LABEL = 'Точно не порекомендую';
export const NPS_DEFAULT_HIGH_LABEL = 'Точно порекомендую';

export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  text: string;
  required: boolean;
  /** Для single/multi — список вариантов. */
  options?: string[];
  /** Для scale — нижняя/верхняя граница (по умолчанию 1..10). */
  scaleMin?: number;
  scaleMax?: number;
  /** Для smiley — подписи под точками, длина = число точек (3 или 5). */
  smileyLabels?: string[];
  /** Для nps — подписи крайних значений шкалы 0 и 10. */
  npsLowLabel?: string;
  npsHighLabel?: string;
};

export type Survey = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  anonymous: boolean;
  questions: SurveyQuestion[];
  createdByUserId: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

/** Публичная проекция опроса для респондента — без служебных полей. */
export type PublicSurvey = {
  slug: string;
  title: string;
  description?: string;
  anonymous: boolean;
  questions: SurveyQuestion[];
};

export type SurveyAnswerValue = string | string[] | number | boolean | null;

export type SurveyResponse = {
  id: string;
  surveyId: string;
  submittedAt: string;
  /** Отсутствует целиком, если опрос анонимный — ни при каких условиях не пишем сюда id/имя. */
  respondent?: { userId: number; name: string };
  answers: Record<string, SurveyAnswerValue>;
};

export type CreateSurveyInput = {
  title: string;
};

export type UpdateSurveyInput = {
  title?: string;
  description?: string;
  anonymous?: boolean;
  questions?: SurveyQuestion[];
};

export function defaultQuestionForType(type: SurveyQuestionType): Omit<SurveyQuestion, 'id'> {
  switch (type) {
    case 'single':
    case 'multi':
      return { type, text: '', required: true, options: ['Вариант 1', 'Вариант 2'] };
    case 'scale':
      return { type, text: '', required: true, scaleMin: 1, scaleMax: 10 };
    case 'smiley':
      return { type, text: '', required: true, smileyLabels: [...SMILEY_LABELS] };
    case 'nps':
      return {
        type,
        text: '',
        required: true,
        npsLowLabel: NPS_DEFAULT_LOW_LABEL,
        npsHighLabel: NPS_DEFAULT_HIGH_LABEL
      };
    default:
      return { type, text: '', required: type !== 'info' };
  }
}

export function slugify(input: string): string {
  const translit: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya'
  };
  const base = input
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => translit[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'oprosy';
}

export function statusLabel(status: SurveyStatus): string {
  return status === 'draft' ? 'Черновик' : status === 'published' ? 'Опубликован' : 'Закрыт';
}
