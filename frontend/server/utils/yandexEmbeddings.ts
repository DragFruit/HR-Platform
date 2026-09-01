const YANDEX_EMBEDDING_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding';

type EmbedKind = 'doc' | 'query';

type YandexEmbedConfig = {
  folderId: string;
  docModelUri: string;
  queryModelUri: string;
  iamToken?: string;
  apiKey?: string;
};

/** Квота Yandex: ~10 emb/sec. Держим очередь с паузой, иначе 429 и «перекур». */
const EMBED_MIN_INTERVAL_MS = 120;
let embedChain: Promise<unknown> = Promise.resolve();
let lastEmbedAt = 0;

function enqueueEmbed<T>(task: () => Promise<T>): Promise<T> {
  const run = embedChain.then(async () => {
    const wait = Math.max(0, EMBED_MIN_INTERVAL_MS - (Date.now() - lastEmbedAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastEmbedAt = Date.now();
    return task();
  });
  embedChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function yandexEmbedTextOnce(text: string, kind: EmbedKind, attempt = 0): Promise<number[]> {
  const config = readConfig();
  const safe = text.trim().slice(0, 8000);
  if (!safe) return [];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-folder-id': config.folderId
  };
  if (config.apiKey) headers.Authorization = `Api-Key ${config.apiKey}`;
  else headers.Authorization = `Bearer ${config.iamToken}`;

  const res = await fetch(YANDEX_EMBEDDING_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      modelUri: kind === 'doc' ? config.docModelUri : config.queryModelUri,
      text: safe
    }),
    signal: AbortSignal.timeout(12000)
  });

  if (res.status === 429 && attempt < 4) {
    const backoff = 400 * (attempt + 1);
    await new Promise((r) => setTimeout(r, backoff));
    return yandexEmbedTextOnce(text, kind, attempt + 1);
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw createError({
      statusCode: 502,
      statusMessage: `Yandex embeddings: HTTP ${res.status}. ${raw ? raw.slice(0, 200) : ''}`
    });
  }

  const json = (await res.json()) as { embedding?: number[]; result?: { embedding?: number[] } };
  const vector = json.embedding ?? json.result?.embedding;
  if (!Array.isArray(vector) || !vector.length) {
    throw createError({ statusCode: 502, statusMessage: 'Yandex embeddings: пустой вектор' });
  }
  return vector.map((n) => Number(n) || 0);
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readConfig(): YandexEmbedConfig {
  const folderId = getEnv('YANDEX_GPT_FOLDER_ID');
  if (!folderId) {
    throw createError({ statusCode: 500, statusMessage: 'Yandex embeddings: не задан YANDEX_GPT_FOLDER_ID' });
  }

  const docModelUri =
    getEnv('YANDEX_EMBED_DOC_URI') || `emb://${folderId}/text-search-doc/latest`;
  const queryModelUri =
    getEnv('YANDEX_EMBED_QUERY_URI') || `emb://${folderId}/text-search-query/latest`;

  const iamToken = getEnv('YANDEX_GPT_IAM_TOKEN');
  const apiKey = getEnv('YANDEX_GPT_API_KEY');
  if (!iamToken && !apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Yandex embeddings: нужен YANDEX_GPT_API_KEY или YANDEX_GPT_IAM_TOKEN'
    });
  }

  return {
    folderId,
    docModelUri,
    queryModelUri,
    iamToken: iamToken || undefined,
    apiKey: apiKey || undefined
  };
}

/** Один текст → вектор. kind=doc для индекса статей, query — для вопроса. */
export async function yandexEmbedText(text: string, kind: EmbedKind): Promise<number[]> {
  return enqueueEmbed(() => yandexEmbedTextOnce(text, kind));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
