import { requireRole } from '../../utils/requireRole';
import { createKnowledgeAiDegradedNotification } from '../../utils/adminNotificationsStore';
import { yandexChatAnswer, yandexChatAnswerAmbiguous } from '../../utils/yandexGpt';
import {
  buildRagAmbiguousContext,
  buildRagContext,
  retrieveKnowledgeDetailed,
  retrieveKnowledgeLexicalFallback
} from '../../utils/knowledgeRag';

type HistoryItem = { role?: string; text?: string };

type Body = {
  question?: string;
  context?: string;
  history?: HistoryItem[];
};

export type YandexAskCitation = {
  id: string;
  title: string;
};

const SMOKE_PREFIX =
  'Бот ушёл на перекур, но скоро вернётся. Пока ответы могут быть менее точными.\n\n';

function normalizeHistory(raw: HistoryItem[] | undefined): { role: 'user' | 'assistant'; text: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { role: 'user' | 'assistant'; text: string }[] = [];
  for (const item of raw.slice(-8)) {
    const text = String(item?.text || '').trim();
    if (!text) continue;
    const role = item?.role === 'assistant' || item?.role === 'bot' ? 'assistant' : 'user';
    out.push({ role, text: text.slice(0, 800) });
  }
  return out;
}

/**
 * Спросить ИИ: смысл + память диалога; при сбое Yandex — упрощённый ответ + алерт админу.
 */
export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['employee', 'manager', 'hr', 'admin']);

  const payload = (await readBody<Body>(event)) || {};
  const question = String(payload.question || '').trim();
  if (!question) throw createError({ statusCode: 400, statusMessage: 'question обязателен' });
  if (question.length > 2000) {
    throw createError({ statusCode: 400, statusMessage: 'question слишком длинный (макс. 2000)' });
  }

  const history = normalizeHistory(payload.history);
  const viewer = { role: session.role, department: session.department };

  const alertAdmin = async (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await createKnowledgeAiDegradedNotification({
        employee_id: session.id,
        employee_name: session.name || session.email || 'сотрудник',
        error_message: msg.slice(0, 500),
        question
      });
    } catch (notifyErr) {
      console.warn('[knowledge-ai] admin notify failed', notifyErr);
    }
  };

  try {
    const retrieved = await retrieveKnowledgeDetailed(question, { viewer });
  if (!retrieved.hits.length) {
    return {
      answer:
        'В базе знаний пока нет материала по этому вопросу.\n\n' +
        'Если тема нужна команде — можно дописать статью самим (Админ → База знаний) или написать HR, что не хватает знаний по этой теме. Мы добавим.',
      citations: [] as YandexAskCitation[],
      found: false,
      ambiguous: false,
      degraded: false
    };
  }

    if (retrieved.ambiguous && retrieved.branches.length >= 2) {
      const context = buildRagAmbiguousContext(retrieved.branches);
      const answer = await yandexChatAnswerAmbiguous(question, context);
      return {
        answer,
        citations: retrieved.branches.map((b) => ({ id: b.hit.articleId, title: b.hit.title })),
        found: true,
        ambiguous: true,
        degraded: false
      };
    }

    const context = buildRagContext(retrieved.hits);
    const answer = await yandexChatAnswer(question, context, { history });
    return {
      answer,
      citations: retrieved.hits.map((h) => ({ id: h.articleId, title: h.title })),
      found: true,
      ambiguous: false,
      degraded: false
    };
  } catch (err) {
    console.warn('[knowledge-ai] primary path failed', err);
    await alertAdmin(err);

    try {
      const lexHits = await retrieveKnowledgeLexicalFallback(question, { viewer });
      if (!lexHits.length) {
        return {
          answer: `${SMOKE_PREFIX}Сейчас не удалось подобрать материалы. Попробуйте чуть позже или вкладку «Поиск».`,
          citations: [] as YandexAskCitation[],
          found: false,
          ambiguous: false,
          degraded: true
        };
      }
      const context = buildRagContext(lexHits);
      let answer: string;
      try {
        answer = await yandexChatAnswer(question, context, { history });
      } catch {
        answer =
          'Кратко по найденным материалам: откройте ссылки ниже — там актуальные регламенты по запросу.';
      }
      return {
        answer: `${SMOKE_PREFIX}${answer}`,
        citations: lexHits.map((h) => ({ id: h.articleId, title: h.title })),
        found: true,
        ambiguous: false,
        degraded: true
      };
    } catch (fallbackErr) {
      console.warn('[knowledge-ai] lexical fallback failed', fallbackErr);
      return {
        answer: `${SMOKE_PREFIX}Сервис ответов временно недоступен. Загляните во вкладку «Поиск» или повторите вопрос позже.`,
        citations: [] as YandexAskCitation[],
        found: false,
        ambiguous: false,
        degraded: true
      };
    }
  }
});
