/** Короткие реплики без поиска по базе (благодарность / эмоции). */
export const KB_AI_CHITCHAT_REPLY = 'Рад помочь! Что ещё могу сделать?';

/** Вопросы не по базе знаний. */
export const KB_AI_OFFTOPIC_REPLY =
  'Я обучен отвечать только по Базе знаний, другое не умею, извините.';

export type KnowledgeAiIntent = 'chitchat' | 'offtopic' | 'kb';

const CHITCHAT_RE =
  /^(спасибо|благодарю|благодар|отлично|супер|класс|круто|огонь|топ|ок|окей|ладно|понял[аи]?|понятно|ясно|хорошо|замечательно|прекрасно|отлично[\s,]*спасибо|спасибо[\s,]*большое|вс[её]\s*(понятно|ясно|супер|отлично)|👍|🙏|❤️|😘)+[!?.…\s]*$/iu;

/** Явный оффтоп — без вызова модели и без подтягивания статей. */
const OFFTOPIC_RE =
  /\b(погод[аеуы]|температур|прогноз\s+погоды|новост|анекдот|рецепт|футбол|хоккей|курс\s+(доллар|евро)|что\s+ты\s+(любишь|умеешь|думаешь)|кто\s+ты\b|как\s+тебя\s+зовут|расскажи\s+о\s+себе|посоветуй\s+(книг|фильм)|что\s+почитать)\b/i;

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

/** Префиксы, которые просим у модели в system prompt. */
export const KB_AI_PREFIX_CHITCHAT = 'CHITCHAT';
export const KB_AI_PREFIX_OFFTOPIC = 'OFFTOPIC';

export function parseKbAiModelReply(raw: string): {
  intent: KnowledgeAiIntent;
  text: string;
} {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();

  if (upper.startsWith(KB_AI_PREFIX_CHITCHAT)) {
    const rest = trimmed.replace(/^CHITCHAT\s*:?\s*/i, '').trim();
    return { intent: 'chitchat', text: rest || KB_AI_CHITCHAT_REPLY };
  }
  if (upper.startsWith(KB_AI_PREFIX_OFFTOPIC)) {
    const rest = trimmed.replace(/^OFFTOPIC\s*:?\s*/i, '').trim();
    return { intent: 'offtopic', text: rest || KB_AI_OFFTOPIC_REPLY };
  }
  return { intent: 'kb', text: trimmed };
}
