/** Короткие реплики без поиска по базе (благодарность / эмоции). */
export const KB_AI_CHITCHAT_REPLY = 'Рад помочь! Что ещё могу сделать?';

/** Вопросы не по базе знаний (погода, шутки). */
export const KB_AI_OFFTOPIC_REPLY =
  'Я обучен отвечать только по Базе знаний, другое не умею, извините.';

/**
 * Рабочий вопрос, но в базе нет материала.
 * Без приглашения «допишите статью» — на оффтоп/сомнение это вредно.
 */
export const KB_AI_NOT_FOUND_REPLY =
  'В базе знаний пока нет материала по этому вопросу.';

/** Грубость / претензия без нормального вопроса. */
export const KB_AI_CLARIFY_REPLY =
  'Прошу прощения, уточните вопрос, чтобы я подобрал более точный ответ в базе';

/**
 * Вопросы про клиентские/маркетинговые кейсы — пока нет в базе статей.
 * Текст зафиксирован: не перефразировать.
 */
export const KB_AI_CASES_REPLY =
  'Пока что я не умею работать с кейсами, но уже прохожу обучение! Скоро смогу ответить на все ваши вопросы по ним.';

export type KnowledgeAiIntent =
  | 'chitchat'
  | 'offtopic'
  | 'clarify'
  | 'kb'
  | 'not_found'
  | 'cases';

/**
 * Кейсы / case studies (ещё не в статьях БЗ).
 * Без `\b` для кириллицы; не цеплять куски внутри других слов.
 */
const CASE_STUDY_RE =
  /(?<![а-яёa-z0-9])кейс(?:а|у|ом|е|ы|ов|ам|ами|ах)?(?![а-яёa-z0-9])|(?<![a-z0-9])case[\s-]*stud(?:y|ies)(?![a-z0-9])/iu;

/** Вопрос про кейсы — без RAG/GPT и без «Ещё по теме». */
export function detectKbAiCasesQuestion(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  return CASE_STUDY_RE.test(t);
}

const CHITCHAT_RE =
  /^(спасибо|благодарю|благодар|отлично|супер|класс|круто|огонь|топ|ок|окей|ладно|понял[аи]?|понятно|ясно|хорошо|замечательно|прекрасно|отлично[\s,]*спасибо|спасибо[\s,]*большое|вс[её]\s*(понятно|ясно|супер|отлично)|👍|🙏|❤️|😘)+[!?.…\s]*$/iu;

/** Приветствия — без RAG/Yandex. Без `\b`: для кириллицы word-boundary в JS не срабатывает. */
const GREETING_RE =
  /^(привет(ик|ствую)?|прив|здравствуй(те)?|здрасте|добр(ый|ое|ого)\s+(день|утро|вечер)|хай|hello|hi)[!?.…\s]*$/iu;

const HOW_ARE_YOU_RE = /как\s+(дела|ты|жизнь)|что\s+нового|how\s+are\s+you/i;

/** Ответ на приветствие. */
export const KB_AI_GREETING_REPLY = 'Здравствуйте! Чем помочь по базе знаний?';

/**
 * Явный оффтоп / бессмыслица — без вызова модели и без статей.
 * Без `\b`: для кириллицы word-boundary в JS часто не срабатывает.
 */
const OFFTOPIC_RE =
  /(погод[аеуыи]|температур|прогноз\s+погоды|новост|анекдот|рецепт|футбол|хоккей|курс\s+(доллар|евро)|что\s+ты\s+(любишь|умеешь|думаешь)|кто\s+ты(?:\s|$|[?!.])|как\s+тебя\s+зовут|расскажи\s+о\s+себе|посоветуй\s+(книг|фильм)|что\s+почитать|кот(ик|ёнок|ята)?|кошк|щен(ок|к)|собак|питомц|хомяк|попуга|траву|наркоман|наркот|марихуан|гашиш|кокаин|спайс|экстази|лсд|где\s+(взять|купить|достать)\s+(кот|щен|трав)|люблю\s+(кот|кошк|собак)|ненавижу\s+(кот|собак))/i;

/** Короткие личные реплики вне работы: «люблю котов», «хочу пиццу». */
const CASUAL_PERSONAL_RE =
  /^(я\s+)?(люблю|ненавижу|хочу|скучаю|грустн|весел)\b.{0,40}$/iu;

/** Признаки рабочего вопроса по базе (отпуск, доступы, HR, контакты…). */
const WORKPLACE_HINT_RE =
  /(отпуск|отгул|дейоф|day\s*off|dayoff|vpn|доступ|afina|афин|битрикс|bitrix|зарплат|больничн|командиров|регламент|офис|отдел|кадр|трудоустрой|увольн|уволи|уволю|адаптац|мерч|ачивк|иде[яи]|wifi|wi-?fi|почт[аеуы]|1[сc]|лицензи|сертификат|собесед|ваканс|\bhr\b|эйчар|сотрудник|кандидат|клиент|проект|задач|день\s*рожден|вайб|vibe|программатик|programmatic|контакт|партн[её]р|площадк|юрист|яндекс|коллтрек|utm|списан|акт[аыу]?|дизайн|переводчик|click\.?ru)/i;

/** Звуки / шутки / «мяу?» — не вопрос по базе. */
const NONSENSE_RE =
  /^(мяу+|гав+|мур+|ква+|бее*|мее*|хрю+|кукареку|чирик|ахах*|ха+|хи+|лол+|кек+|угу+|хм+|эм+|ы+|аа+|оо+|ээ+)[!?.…]*$/iu;

/** Ответ модели без префикса, но уже отказ «не по базе». */
const OFFTOPIC_ANSWER_RE =
  /(только\s+по\s+базе\s+знаний|не\s+умею\s+(отвечать\s+)?(на\s+)?(другие|такое|это)|вне\s+базы\s+знаний|не\s+по\s+теме\s+базы)/i;

/** Оскорбления и мат. */
const RUDE_RE =
  /(долбо[её]б|долба[её]б|идиот|дебил|туп(ой|ая|ица)|ху[йяе]|хер|блять|бляд|сука|пизд|ебан|ёбан|мудак|говно|заткни|чмо|мраз|тварь|нахуй|пош[её]л\s+на|уродина|конченн)/i;

/** Претензия к ответу бота (не слово «ошибка» внутри рабочего вопроса). */
const COMPLAINT_RE =
  /(ты\s+не\s+то|не\s+то\s+говоришь|вр[её]шь|бред|чушь|фигня|хуйню|херню|нес[её]шь\s+чушь)/i;

/** Одна короткая претензия без контекста: «ошибка», «неправильно». */
const SHORT_COMPLAINT_RE = /^(ошиб(ка|ся|лись)|неправильно)[!?.…\s]*$/iu;

/** Быстрый локальный детект «спасибо / привет / как дела» без вызова модели. */
export function detectKbAiChitchat(raw: string): boolean {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 72) return false;
  if (t.split(/\s+/).length > 10) return false;

  if (GREETING_RE.test(t) || (HOW_ARE_YOU_RE.test(t) && t.length <= 48)) {
    return true;
  }

  if (/[?]/.test(t)) return false;
  if (t.split(/\s+/).length > 8) return false;
  return CHITCHAT_RE.test(t);
}

export function detectKbAiOfftopic(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (OFFTOPIC_RE.test(t)) return true;
  if (CASUAL_PERSONAL_RE.test(t) && !looksLikeWorkplaceKbQuestion(t)) return true;
  return detectKbAiNonsense(t);
}

/** Есть ли признаки рабочего вопроса по корпоративной базе. */
export function looksLikeWorkplaceKbQuestion(raw: string): boolean {
  return WORKPLACE_HINT_RE.test(raw.trim());
}

/**
 * Уточнения в диалоге: «а ещё?», «подробнее», «ещё другие», «это все?», «а остальные?» —
 * не оффтоп сами по себе; для RAG склеиваем с прошлым вопросом.
 */
const CLARIFY_FOLLOWUP_RE =
  /^(а\s+)?(ещ[её]|там|тут|если|ну)\b|^(какие\s+)?ещ[её]|подробнее|что\s+ещ[её]|какие\s+ещ[её]|а\s+что|а\s+как|а\s+где|продолж|уточн|а\s+кроме|кроме\s+этого|кроме\s+этих|остальн|не\s+назва|это\s+все|это\s+вс[её]|все\s+ли|вс[её]\s+ли|допис|дополни|назови\s+ещ|напиши\s+ещ|перечисл\s+ещ|ещ[её]\s+друг|друг(ие|их)\s+(программ|компани|партн|площад|из\s+списка|с\s+которы)/i;

export function isKbClarifyingFollowUp(raw: string): boolean {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 120) return false;
  if (t.split(/\s+/).length > 18) return false;
  if (CLARIFY_FOLLOWUP_RE.test(t)) return true;
  // короткие «а …?» после рабочего ответа
  return /^а\s+.+\?$/iu.test(t) && t.length <= 64;
}

/**
 * Follow-up по базе при живой истории: не принимать OFFTOPIC модели/клиента.
 * Явный оффтоп (погода/коты) без follow-up-маркеров по-прежнему режется раньше.
 */
export function shouldRejectModelOfftopic(
  question: string,
  history: { role?: string; text?: string }[] | undefined,
  opts?: { hasKbContext?: boolean }
): boolean {
  if (!Array.isArray(history) || !history.length) return false;
  if (detectKbAiOfftopic(question) && !isKbClarifyingFollowUp(question)) return false;
  if (opts?.hasKbContext) {
    return (
      isKbClarifyingFollowUp(question) ||
      looksLikeWorkplaceKbQuestion(question) ||
      historySuggestsWorkplace(history)
    );
  }
  return isKbClarifyingFollowUp(question) && historySuggestsWorkplace(history);
}

export function historySuggestsWorkplace(
  history: { role?: string; text?: string }[] | undefined
): boolean {
  if (!Array.isArray(history) || !history.length) return false;
  return history.some((h) => looksLikeWorkplaceKbQuestion(String(h?.text || '')));
}

/**
 * Для поиска: уточнение склеиваем с последним рабочим вопросом из истории.
 */
export function expandQuestionFromHistory(
  question: string,
  history: { role?: string; text?: string }[] | undefined
): string {
  const q = question.trim();
  if (!q || !isKbClarifyingFollowUp(q) || !Array.isArray(history) || !history.length) {
    return q;
  }
  const users = history
    .filter((h) => (h?.role === 'user' || !h?.role) && String(h?.text || '').trim())
    .map((h) => String(h.text).trim());
  const lastWork = [...users].reverse().find((t) => looksLikeWorkplaceKbQuestion(t));
  const base = lastWork || users[users.length - 1];
  if (!base || base === q) return q;
  return `${base}\nУточнение: ${q}`;
}

/**
 * Пустой поиск: явный оффтоп → отказ; иначе «нет в базе» без CTA.
 * Нельзя: «нет слов из whitelist → оффтоп» — ломает рабочие вопросы (эйчар, клиенты…).
 */
export function emptyKbReplyMode(
  question: string,
  history: { role?: string; text?: string }[] = []
): 'offtopic' | 'not_found' {
  if (isKbClarifyingFollowUp(question) && history.length > 0) {
    return 'not_found';
  }
  if (detectKbAiOfftopic(question)) return 'offtopic';
  return 'not_found';
}

/** Жёсткий оффтоп до RAG (коты, наркотики, погода) — без whitelist «это работа?». */
export function shouldSkipRagAsOfftopic(
  question: string,
  history: { role?: string; text?: string }[] = []
): boolean {
  if (isKbClarifyingFollowUp(question) && history.length > 0) return false;
  return detectKbAiOfftopic(question);
}

/**
 * Бессмысленные реплики: «мяу?», звуки, одни эмодзи/знаки —
 * тот же отказ, что и на погоду (не искать статьи).
 */
export function detectKbAiNonsense(raw: string): boolean {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return true;
  if (NONSENSE_RE.test(t)) return true;
  // нет букв/цифр — только эмодзи и пунктуация
  if (!/[a-zа-яё0-9]/i.test(t)) return true;
  return false;
}

/** Грубость или претензия к боту — без статей, попросить уточнить вопрос. */
export function detectKbAiClarify(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (RUDE_RE.test(t)) return true;
  if (COMPLAINT_RE.test(t)) return true;
  if (SHORT_COMPLAINT_RE.test(t)) return true;
  return false;
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
