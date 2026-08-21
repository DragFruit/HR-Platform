import { expandQueryWithSynonyms, isRewriteSafe } from './knowledgeRagLexical';

const YANDEX_COMPLETION_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

function getEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Осторожная переформулировка для поиска: только синонимы/порядок слов.
 * При любой сомнительности — null (остаётся исходный вопрос).
 */
export async function rewriteQueryConservatively(question: string): Promise<string | null> {
  const q = question.trim();
  if (!q || q.length < 8) return null;

  const folderId = getEnv('YANDEX_GPT_FOLDER_ID');
  const modelUri = getEnv('YANDEX_GPT_MODEL_URI') || (folderId ? `gpt://${folderId}/yandexgpt-lite` : '');
  const iamToken = getEnv('YANDEX_GPT_IAM_TOKEN');
  const apiKey = getEnv('YANDEX_GPT_API_KEY');
  if (!folderId || !modelUri || (!iamToken && !apiKey)) return null;

  const system = [
    'Ты помогаешь поиску по базе знаний.',
    'Переформулируй вопрос сотрудника для поиска: те же сущности и тот же смысл.',
    'Можно заменить слова синонимами и чуть переставить порядок.',
    'Нельзя: менять тему, добавлять новые факты, имена отделов, продукты или условия, которых не было.',
    'Если переформулировать без смены смысла нельзя — верни исходный текст как есть.',
    'Ответ: одна строка без кавычек, без пояснений.'
  ].join('\n');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-folder-id': folderId
  };
  if (apiKey) headers.Authorization = `Api-Key ${apiKey}`;
  else headers.Authorization = `Bearer ${iamToken}`;

  const res = await fetch(YANDEX_COMPLETION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      modelUri,
      completionOptions: { stream: false, temperature: 0.1, maxTokens: 120 },
      messages: [
        { role: 'system', text: system },
        { role: 'user', text: q }
      ]
    })
  });

  if (!res.ok) return null;
  const json = await res.json();
  const text = String(json?.result?.alternatives?.[0]?.message?.text || '')
    .trim()
    .replace(/^["«]|["»]$/g, '')
    .split('\n')[0]
    ?.trim();

  if (!text || text === q) return null;
  if (!isRewriteSafe(q, text)) return null;
  return text;
}

export type RetrievalQueryPlan = {
  /** Варианты для эмбеддинга/поиска (исходный всегда первый). */
  queries: string[];
  /** Текст для словесного слоя (исходный + синонимы). */
  lexicalQuery: string;
  rewriteUsed: string | null;
};

/** Собрать варианты запроса: исходный, синонимы, безопасная нейро-переформулировка. */
export async function buildRetrievalQueryPlan(question: string): Promise<RetrievalQueryPlan> {
  const original = question.trim();
  const lexicalQuery = expandQueryWithSynonyms(original);
  const queries = [original];
  if (lexicalQuery !== original) queries.push(lexicalQuery);

  let rewriteUsed: string | null = null;
  try {
    rewriteUsed = await rewriteQueryConservatively(original);
    if (rewriteUsed && !queries.includes(rewriteUsed)) queries.push(rewriteUsed);
  } catch {
    rewriteUsed = null;
  }

  return { queries, lexicalQuery, rewriteUsed };
}
