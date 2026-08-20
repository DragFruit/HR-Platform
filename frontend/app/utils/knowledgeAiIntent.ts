/** Короткие реплики без поиска по базе (благодарность / эмоции). */
export const KB_AI_CHITCHAT_REPLY = 'Рад помочь! Что ещё могу сделать?';

/** Вопросы не по базе знаний. */
export const KB_AI_OFFTOPIC_REPLY =
  'Я обучен отвечать только по Базе знаний, другое не умею, извините.';

/** Грубость / претензия без нормального вопроса. */
export const KB_AI_CLARIFY_REPLY =
  'Прошу прощения, уточните вопрос, чтобы я подобрал более точный ответ в базе';

export type KnowledgeAiIntent = 'chitchat' | 'offtopic' | 'clarify' | 'kb';

const CHITCHAT_RE =
  /^(спасибо|благодарю|благодар|отлично|супер|класс|круто|огонь|топ|ок|окей|ладно|понял[аи]?|понятно|ясно|хорошо|замечательно|прекрасно|отлично[\s,]*спасибо|спасибо[\s,]*большое|вс[её]\s*(понятно|ясно|супер|отлично)|👍|🙏|❤️|😘)+[!?.…\s]*$/iu;

/**
 * Явный оффтоп — без вызова модели и без статей.
 * Без `\b`: для кириллицы word-boundary в JS часто не срабатывает.
 */
const OFFTOPIC_RE =
  /(погод[аеуыи]|температур|прогноз\s+погоды|новост|анекдот|рецепт|футбол|хоккей|курс\s+(доллар|евро)|что\s+ты\s+(любишь|умеешь|думаешь)|кто\s+ты(?:\s|$|[?!.])|как\s+тебя\s+зовут|расскажи\s+о\s+себе|посоветуй\s+(книг|фильм)|что\s+почитать)/i;

/** Ответ модели без префикса, но уже отказ «не по базе». */
const OFFTOPIC_ANSWER_RE =
  /(только\s+по\s+базе\s+знаний|не\s+умею\s+(отвечать\s+)?(на\s+)?(другие|такое|это)|вне\s+базы\s+знаний|не\s+по\s+теме\s+базы)/i;

/** Оскорбления и мат. */
const RUDE_RE =
  /(долбо[её]б|долба[её]б|идиот|дебил|туп(ой|ая|ица)|ху[йяе]|хер|блять|бляд|сука|пизд|ебан|ёбан|мудак|говно|заткни|чмо|мраз|тварь|нахуй|пош[её]л\s+на|уродина|конченн)/i;

/** Претензия к ответу без нового вопроса по теме. */
const COMPLAINT_RE =
  /(ты\s+не\s+то|не\s+то\s+говоришь|вр[её]шь|бред|чушь|фигня|ошиб(ка|ся|лись)|неправильно|хуйню|херню|нес[её]шь\s+чушь)/i;

/** Быстрый локальный детект «спасибо / отлично» без вызова модели. */
export function detectKbAiChitchat(raw: string): boolean {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 72) return false;
  if (/[?]/.test(t)) return false;
  if (t.split(/\s+/).length > 8) return false;
  return CHITCHAT_RE.test(t);
}

export function detectKbAiOfftopic(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return OFFTOPIC_RE.test(t);
}

/** Грубость или «ты не то говоришь» — без статей, попросить уточнить вопрос. */
export function detectKbAiClarify(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return RUDE_RE.test(t) || COMPLAINT_RE.test(t);
}

/** Префиксы, которые просим у модели в system prompt. */
export const KB_AI_PREFIX_CHITCHAT = 'CHITCHAT';
export const KB_AI_PREFIX_OFFTOPIC = 'OFFTOPIC';
export const KB_AI_PREFIX_CLARIFY = 'CLARIFY';

export function parseKbAiModelReply(raw: string): {
  intent: KnowledgeAiIntent;
  text: string;
} {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();

  if (upper.startsWith(KB_AI_PREFIX_CHITCHAT) || /^CHITCHAT\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^CHITCHAT\s*:?\s*/i, '').trim();
    return { intent: 'chitchat', text: rest || KB_AI_CHITCHAT_REPLY };
  }
  if (upper.startsWith(KB_AI_PREFIX_OFFTOPIC) || /^OFFTOPIC\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^OFFTOPIC\s*:?\s*/i, '').trim();
    return { intent: 'offtopic', text: rest || KB_AI_OFFTOPIC_REPLY };
  }
  if (upper.startsWith(KB_AI_PREFIX_CLARIFY) || /^CLARIFY\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^CLARIFY\s*:?\s*/i, '').trim();
    return { intent: 'clarify', text: rest || KB_AI_CLARIFY_REPLY };
  }
  // Модель забыла префикс, но уже отказала — статьи не клеим
  if (OFFTOPIC_ANSWER_RE.test(trimmed)) {
    return { intent: 'offtopic', text: trimmed };
  }
  return { intent: 'kb', text: trimmed };
}
