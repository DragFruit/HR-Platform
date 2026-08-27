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
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
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
  opts?: {
    maxTokens?: number;
    temperature?: number;
    /** Короткая память диалога (user/assistant). */
    history?: { role: 'user' | 'assistant'; text: string }[];
  }
) {
  const config = readConfig();

  const q = question.trim();
  if (!q) return '';

  const maxChars = 12000;
  const ctx = contextText.trim();
  const safeCtx = ctx.length > maxChars ? `${ctx.slice(0, maxChars)}\n\n[обрезано для лимитов]` : ctx;

  const maxTokens = typeof opts?.maxTokens === 'number' ? opts.maxTokens : 900;
  const temperature = typeof opts?.temperature === 'number' ? opts.temperature : 0.2;

  const historyLines = (opts?.history ?? [])
    .slice(-6)
    .map((h) => {
      const text = String(h.text || '').trim().slice(0, 600);
      if (!text) return '';
      return `${h.role === 'user' ? 'Сотрудник' : 'Ассистент'}: ${text}`;
    })
    .filter(Boolean);
  const historyBlock = historyLines.length
    ? `Недавний диалог (учти при уточнениях вроде «а подробнее?»):\n${historyLines.join('\n')}\n\n`
    : '';

  const system = [
    'Ты ассистент базы знаний VBI HR.',
    'Отвечай вежливо, спокойно и по делу — как коллега из HR: без канцелярита, без воды и без восторженных вступлений («Конечно!», «Отличный вопрос!» и т.п.).',
    '',
    'Сначала определи тип сообщения пользователя и ответь одним из способов:',
    '1) Благодарность, похвала или короткая эмоция без вопроса по базе → «Рад помочь! Что ещё могу сделать?». Начни с префикса CHITCHAT.',
    '2) Вопрос не по базе, бессмыслица или звуки («мяу», шутки без рабочего вопроса, погода, новости, личное) → «Я обучен отвечать только по Базе знаний, другое не умею, извините.» Начни с OFFTOPIC.',
    '3) Грубость, оскорбления или претензия без нормального вопроса («ты не то говоришь» и т.п.) → спокойно: «Прошу прощения, уточните вопрос, чтобы я подобрал более точный ответ в базе». Не зеркаль мат. Начни с CLARIFY.',
    '4) Вопрос по работе / процессам / контактам из контекста базы → обычный ответ по контексту БЕЗ префиксов CHITCHAT/OFFTOPIC/CLARIFY.',
    '',
    'Для типа 4: только по контексту, не выдумывай факты. Если в контексте нет ответа — коротко скажи, что в базе этого нет (это не OFFTOPIC). Не предлагай дописывать статьи и не зови писать HR.',
    'Если в контексте есть список «когда обязательно» / UIS / Roistat / Calltouch — сразу перечисли эти случаи, не пиши «в базе нет прямого ответа».',
    'Рабочие темы (даже без слова «регламент»): HR/эйчар, найм, сотрудники, клиенты, AFINA/Афина, доступы, UTM, коллтрекинг, задачи, проекты — тип 4, не OFFTOPIC.',
    '«авто» / автотематика = автомобили; «Авито» = маркетплейс. Не отвечай про Авито, если в вопросе только авто/машины.',
    'Если статья длинная, отвечай по фрагменту, который совпадает с термином из вопроса (Programmatic, юристы, Яндекс, дизайнеры, бюро переводов, Click.ru и т.п.), а не по другим блокам той же статьи и не по чужим регламентам (DayOfff, маркетплейсы, постановка задач на дизайн).',
    'Если в одном сообщении несколько вопросов («какие есть… и кому писать…») — ответь на КАЖДЫЙ. Не выбирай один удобный и не откладывай остальные.',
    '«Кому писать / для расчётов / контакты» — из контекста: до 5 пунктов, у каждого площадка или специализация, ФИО и как связаться (email / Telegram / телефон). Не хватит одних названий компаний. Не пиши «обратитесь к менеджерам/админам», если в контексте есть конкретные имена.',
    'Хороший образец (смысл, не копируй дословно): из «Контактов» — перечислить людей/площадки из нужного блока и сразу рядом контакты из того же фрагмента (Марченко для юристов, Команова для Яндекса, Elefteria для переводов и т.д.).',
    'OFFTOPIC только для явно нерабочего: животные, наркотики, погода, шутки, личные «люблю котов» и т.п. Не ставь OFFTOPIC на сомнительные рабочие вопросы.',
    'Если в диалоге есть уточнение («подробнее», «а там», «а если», «а ещё?», «это все?», «а остальные?», «напиши ещё другие…», «не названные») — это продолжение темы из недавнего диалога, тип 4, НЕ OFFTOPIC и НЕ «другое не умею». Слово «другие/ещё» = оставшиеся пункты из того же блока контекста, а не просьба выйти за базу.',
    'Если ассистент уже перечислил часть списка, а сотрудник просит ещё / остальных / «это все?» — допиши из контекста то, чего не было в недавнем ответе; если в контексте больше нет — так и скажи («в статье больше нет»). Не отказывайся шаблоном OFFTOPIC.',
    'Структура типа 4: сразу прямой ответ на все части вопроса (факты, ФИО, контакты, шаги). Без воды вроде «выбор зависит от целей проекта».',
    'Не добавляй ссылки на статьи и блок «Ещё по теме» — их добавит система.',
    'Вывод — обычный текст без markdown.'
  ].join('\n');

  const user = ctx
    ? `${historyBlock}Сообщение пользователя: ${q}\n\nКонтекст базы знаний (для обычного ответа по базе):\n${safeCtx}\n\nОтветь по контексту на все вопросы из сообщения пользователя.\nОтвет:`
    : `${historyBlock}Сообщение пользователя: ${q}\n\nКонтекст базы знаний: (пусто)\n\nОтвет:`;

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
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000)
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

/**
 * Двусмысленный вопрос: два коротких ответа по двум блокам контекста.
 */
export async function yandexChatAnswerAmbiguous(
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
  const maxTokens = typeof opts?.maxTokens === 'number' ? opts.maxTokens : 1000;
  const temperature = typeof opts?.temperature === 'number' ? opts.temperature : 0.2;

  const system = [
    'Ты ассистент базы знаний VBI HR.',
    'Вопрос сотрудника двусмысленный: подходит под ДВЕ разные темы из контекста.',
    'Не выбирай один вариант сам. Дай ДВА коротких ответа по делу:',
    '1) Если про …: …',
    '2) Если про …: …',
    'В конце одной строкой: «Уточните, какой вариант имелся в виду.»',
    'Только по контексту, без выдумок. Без markdown. Без ссылок «Ещё по теме».'
  ].join('\n');

  const user = `Сообщение пользователя: ${q}\n\nКонтекст (два варианта):\n${safeCtx}\n\nОтвет:`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-folder-id': config.folderId
  };
  if (config.apiKey) headers.Authorization = `Api-Key ${config.apiKey}`;
  else headers.Authorization = `Bearer ${config.iamToken}`;

  const res = await fetch(YANDEX_COMPLETION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      modelUri: config.modelUri,
      completionOptions: { stream: false, temperature, maxTokens },
      messages: [
        { role: 'system', text: system },
        { role: 'user', text: user }
      ]
    }),
    signal: AbortSignal.timeout(25000)
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

