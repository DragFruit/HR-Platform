const YANDEX_COMPLETION_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

type YandexGptConfig = {
  folderId: string;
  modelUri: string;
  iamToken?: string;
  apiKey?: string;
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readConfig(): YandexGptConfig {
  const folderId = getEnv('YANDEX_GPT_FOLDER_ID');
  const modelUri = getEnv('YANDEX_GPT_MODEL_URI') || (folderId ? `gpt://${folderId}/yandexgpt-lite` : '');
  const iamToken = getEnv('YANDEX_GPT_IAM_TOKEN');
  const apiKey = getEnv('YANDEX_GPT_API_KEY');

  if (!folderId) {
    throw createError({ statusCode: 500, statusMessage: 'Yandex GPT: не задан YANDEX_GPT_FOLDER_ID' });
  }
  if (!modelUri) {
    throw createError({ statusCode: 500, statusMessage: 'Yandex GPT: не задан YANDEX_GPT_MODEL_URI (и не удалось собрать из folderId)' });
  }
  if (!iamToken && !apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Yandex GPT: не задано YANDEX_GPT_IAM_TOKEN или YANDEX_GPT_API_KEY'
    });
  }

  return { folderId, modelUri, iamToken: iamToken || undefined, apiKey: apiKey || undefined };
}

export async function yandexToMarkdown(sourceText: string, opts?: { maxTokens?: number; temperature?: number }) {
  const config = readConfig();

  const text = sourceText.trim();
  if (!text) {
    return '';
  }

  // Для этапа 3 пока без тяжелых файлов: ограничиваем размер входа, чтобы не упираться в лимиты.
  const maxChars = 20000;
  const safeText = text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[обрезано для лимитов]` : text;

  const maxTokens = typeof opts?.maxTokens === 'number' ? opts.maxTokens : 1800;
  const temperature = typeof opts?.temperature === 'number' ? opts.temperature : 0.4;

  const system = [
    'Ты редактор базы знаний VBI HR.',
    'Твоя задача — преобразовать входной текст в компактный структурированный Markdown для дальнейшего чтения и поиска.',
    'Не добавляй лишние вступления и пояснения.',
    'Не выдумывай факты: если информации недостаточно — просто перефразируй имеющееся.',
    'Верни только Markdown.',
    'Для заголовков используй уровень ## и ### (никаких #).'
  ].join('\n');

  const user = `Входной текст:\n\n${safeText}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-folder-id': config.folderId
  };

  if (config.apiKey) headers.Authorization = `Api-Key ${config.apiKey}`;
  else headers.Authorization = `Bearer ${config.iamToken}`;

  const body = {
    modelUri: config.modelUri,
    completionOptions: {
      stream: false,
      temperature,
      maxTokens
    },
    messages: [
      { role: 'system', text: system },
      { role: 'user', text: user }
    ]
  };

  const res = await fetch(YANDEX_COMPLETION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw createError({
      statusCode: 502,
      statusMessage: `Yandex GPT: HTTP ${res.status}. ${raw ? `Body: ${raw.slice(0, 300)}` : ''}`
    });
  }

  const json = await res.json();
  const textOut = json?.result?.alternatives?.[0]?.message?.text;
  return typeof textOut === 'string' ? textOut.trim() : '';
}

export async function yandexChatAnswer(
  question: string,
  contextText: string,
  opts?: { maxTokens?: number; temperature?: number }
) {
  const config = readConfig();

  const q = question.trim();
  if (!q) return '';

  const maxChars = 12000;
  const ctx = contextText.trim();
  const safeCtx = ctx.length > maxChars ? `${ctx.slice(0, maxChars)}\n\n[обрезано для лимитов]` : ctx;

  const maxTokens = typeof opts?.maxTokens === 'number' ? opts.maxTokens : 900;
  const temperature = typeof opts?.temperature === 'number' ? opts.temperature : 0.2;

  const system = [
    'Ты ассистент базы знаний VBI HR.',
    'Отвечай только по предоставленному контексту.',
    'Если в контексте нет ответа — честно скажи, что данных нет.',
    'Пиши кратко, по делу. Без выдуманных фактов.',
    'Вывод — обычный текст (без markdown-разметки).'
  ].join('\n');

  const user = `Вопрос: ${q}\n\nКонтекст:\n${safeCtx}\n\nОтвет:`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-folder-id': config.folderId
  };

  if (config.apiKey) headers.Authorization = `Api-Key ${config.apiKey}`;
  else headers.Authorization = `Bearer ${config.iamToken}`;

  const body = {
    modelUri: config.modelUri,
    completionOptions: {
      stream: false,
      temperature,
      maxTokens
    },
    messages: [
      { role: 'system', text: system },
      { role: 'user', text: user }
    ]
  };

  const res = await fetch(YANDEX_COMPLETION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw createError({
      statusCode: 502,
      statusMessage: `Yandex GPT chat: HTTP ${res.status}. ${raw ? `Body: ${raw.slice(0, 300)}` : ''}`
    });
  }

  const json = await res.json();
  const textOut = json?.result?.alternatives?.[0]?.message?.text;
  return typeof textOut === 'string' ? textOut.trim() : '';
}

