import type { KnowledgeArticleType, KnowledgeCard } from '~/data/knowledgeBaseCatalog';
import { stemRu } from './ruStem';

/**
 * Обычный поиск /knowledge (вкладка «Поиск»).
 *
 * Запрос → смысловые слова: служебные слова (предлоги, союзы, частицы, местоимения, «как/где/когда»)
 * отбрасываются, остальные сравниваются по основе (stemRu: «отпуска/отпуском/отпуск» — одно слово).
 * Поля с весами: заголовок > теги/раздел/описание > текст статьи. Ранжирование: сначала статьи,
 * где нашлись все смысловые слова, ниже — частичные совпадения.
 *
 * Индекс (словарь основ → статьи) строится один раз на список статей и кэшируется,
 * повторный поиск — проход по словарю основ, без разбора текста статей.
 *
 * Синтаксис сохранён: "фраза" — подстрока, !слово — целое слово, a OR b — любое из слов.
 */

export type ParsedKnowledgeQuery = {
  phrases: string[];
  exact: string[];
  orGroups: string[][];
  /** Смысловые слова запроса (без служебных). */
  soft: string[];
  /** Отброшенные служебные слова. */
  stop: string[];
};

export type KnowledgeSearchFilters = {
  dateFrom: string;
  dateTo: string;
  author: string;
  topic: string;
  type: KnowledgeArticleType | '';
};

export type KnowledgeHit = {
  card: KnowledgeCard;
  score: number;
  /** Сколько смысловых слов запроса нашлось в статье (из `termCount`). */
  matched: number;
  termCount: number;
  titleParts: { text: string; hit: boolean }[];
};

export const KNOWLEDGE_PAGE_SIZE = 5;

export const emptyKnowledgeFilters = (): KnowledgeSearchFilters => ({
  dateFrom: '',
  dateTo: '',
  author: '',
  topic: '',
  type: ''
});

export const hasActiveKnowledgeFilters = (filters: KnowledgeSearchFilters) =>
  Boolean(filters.dateFrom || filters.dateTo || filters.author || filters.topic || filters.type);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ── Служебные слова: не ищем по ним ── */
export const KNOWLEDGE_STOP_WORDS: ReadonlySet<string> = new Set([
  // предлоги
  'в', 'во', 'на', 'по', 'для', 'к', 'ко', 'с', 'со', 'у', 'о', 'об', 'обо', 'от', 'ото', 'до', 'из', 'изо',
  'за', 'над', 'под', 'при', 'про', 'через', 'без', 'между', 'перед', 'около', 'после', 'среди', 'вокруг',
  'из-за', 'из-под', 'насчет', 'вместо', 'кроме', 'внутри',
  // союзы
  'и', 'а', 'но', 'или', 'либо', 'да', 'что', 'чтобы', 'чтоб', 'если', 'то', 'тоже', 'также', 'как', 'так',
  'потому', 'поэтому', 'когда', 'пока', 'хотя', 'причем', 'зато',
  // частицы
  'не', 'ни', 'же', 'ли', 'бы', 'б', 'ведь', 'вот', 'вон', 'только', 'уже', 'еще', 'даже', 'лишь', 'именно',
  'просто', 'разве', 'неужели', 'пусть', 'ну',
  // вопросительные и местоимения
  'где', 'куда', 'откуда', 'зачем', 'почему', 'какой', 'какая', 'какое', 'какие', 'каких', 'каким', 'какую',
  'кто', 'кого', 'кому', 'чем', 'чего', 'чему', 'сколько', 'каков', 'который', 'которая', 'которые',
  'я', 'мы', 'ты', 'вы', 'он', 'она', 'оно', 'они', 'мне', 'меня', 'мной', 'нам', 'нас', 'нами', 'тебе',
  'тебя', 'вам', 'вас', 'ему', 'его', 'ей', 'ее', 'им', 'их', 'ими', 'них', 'нему', 'ней', 'нее', 'него',
  'мой', 'моя', 'мое', 'мои', 'моего', 'моей', 'мою', 'твой', 'ваш', 'ваша', 'ваше', 'ваши', 'наш', 'наша',
  'наше', 'наши', 'свой', 'своя', 'свое', 'свои', 'своего', 'своей', 'свою', 'своим', 'себе', 'себя',
  'это', 'этот', 'эта', 'эти', 'этого', 'этой', 'этом', 'тот', 'та', 'те', 'того', 'той', 'том',
  'весь', 'вся', 'все', 'всё', 'всех', 'всем', 'всего',
  // связки и модальные
  'быть', 'есть', 'был', 'была', 'было', 'были', 'будет', 'будут', 'можно', 'нужно', 'надо', 'нужен', 'нужна',
  'хочу', 'могу', 'мочь',
  // вежливые обращения к поиску
  'пожалуйста', 'подскажи', 'подскажите', 'скажи', 'скажите', 'расскажи', 'расскажите',
  // английские
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'with', 'how', 'what'
]);

/** Нижний регистр + ё→е: «счёт» и «счет» — одно слово. */
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Слова текста (нормализованные). */
export const tokenizeKnowledgeText = (text: string): string[] => norm(text).match(WORD_RE) ?? [];

export const isKnowledgeStopWord = (word: string) => {
  const w = norm(word);
  if (KNOWLEDGE_STOP_WORDS.has(w)) return true;
  // одиночная буква — шум; одиночная цифра — смысл («шаг 3»)
  return w.length < 2 && !/\d/.test(w);
};

/** Смысловые слова запроса без служебных. */
export const meaningfulQueryWords = (raw: string): string[] =>
  tokenizeKnowledgeText(raw).filter((w) => !isKnowledgeStopWord(w));

/* ── Транслит: кириллица ↔ латиница ── */
const CYR_TO_LAT: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};
const LAT_TO_CYR: Record<string, string> = {};
for (const [c, l] of Object.entries(CYR_TO_LAT)) {
  if (l && !LAT_TO_CYR[l]) LAT_TO_CYR[l] = c;
}
LAT_TO_CYR['zh'] = 'ж'; LAT_TO_CYR['kh'] = 'х'; LAT_TO_CYR['ts'] = 'ц';
LAT_TO_CYR['ch'] = 'ч'; LAT_TO_CYR['sh'] = 'ш'; LAT_TO_CYR['shch'] = 'щ';
LAT_TO_CYR['yu'] = 'ю'; LAT_TO_CYR['ya'] = 'я'; LAT_TO_CYR['yo'] = 'ё';

const cyrToLat = (s: string) => s.replace(/./g, (c) => CYR_TO_LAT[c] ?? c);

const latToCyr = (s: string) => {
  let result = '';
  let i = 0;
  while (i < s.length) {
    const four = s.slice(i, i + 4).toLowerCase();
    const three = s.slice(i, i + 3).toLowerCase();
    const two = s.slice(i, i + 2).toLowerCase();
    if (LAT_TO_CYR[four]) { result += LAT_TO_CYR[four]; i += 4; }
    else if (LAT_TO_CYR[three]) { result += LAT_TO_CYR[three]; i += 3; }
    else if (LAT_TO_CYR[two]) { result += LAT_TO_CYR[two]; i += 2; }
    else if (LAT_TO_CYR[s[i].toLowerCase()]) { result += LAT_TO_CYR[s[i].toLowerCase()]!; i += 1; }
    else { result += s[i]; i += 1; }
  }
  return result;
};

/* ── Раскладка: QWERTY ↔ ЙЦУКЕН (набрал не в той раскладке) ── */
const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>~";
const RU_KEYS = "йцукенгшщзхъфывапролджэячсмитьбюёЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁ";
const EN_TO_RU: Record<string, string> = {};
const RU_TO_EN: Record<string, string> = {};
for (let i = 0; i < EN_KEYS.length; i++) {
  EN_TO_RU[EN_KEYS[i]] = RU_KEYS[i];
  RU_TO_EN[RU_KEYS[i]] = EN_KEYS[i];
}
const swapLayoutToRu = (s: string) => s.replace(/./g, (c) => EN_TO_RU[c] ?? c);
const swapLayoutToEn = (s: string) => s.replace(/./g, (c) => RU_TO_EN[c] ?? c);

const isCyrillic = (s: string) => /[а-яё]/i.test(s);
const isLatin = (s: string) => /[a-z]/i.test(s);

/** Все варианты написания токена (транслит, не та раскладка). */
const expandToken = (token: string): string[] => {
  const low = norm(token);
  const variants = new Set<string>([low]);
  if (isCyrillic(low)) {
    variants.add(cyrToLat(low));
    variants.add(swapLayoutToEn(low));
  }
  if (isLatin(low)) {
    variants.add(norm(latToCyr(low)));
    variants.add(norm(swapLayoutToRu(low)));
  }
  return [...variants];
};

/** Узкие группы синонимов/написаний из реальных статей (не толковый словарь). */
const SYNONYM_GROUPS: string[][] = [
  ['зп', 'зарплата', 'заработная'],
  ['вернуть', 'возврат'],
  ['вк', 'вконтакте', 'vk', 'вкр', 'vkr'],
  ['впн', 'vpn'],
  ['директ', 'direct'],
  ['метрика', 'metrika'],
  ['афина', 'afina'],
  ['еком', 'ecom', 'ecommerce', 'екомерс'],
  ['dayoff', 'dayofff', 'дейофф', 'дейоф']
];
const synonymsOf = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const word of group) {
      map.set(stemRu(word), group.filter((w) => w !== word));
    }
  }
  return (word: string) => map.get(stemRu(word)) ?? [];
})();

const hasExactWord = (hay: string, word: string) => {
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRegExp(word)}(?![\\p{L}\\p{N}_])`, 'iu');
  return re.test(hay);
};

export function parseKnowledgeQuery(raw: string): ParsedKnowledgeQuery {
  const phrases: string[] = [];
  const rest = raw.replace(/"([^"]+)"/g, (_, phrase: string) => {
    const trimmed = phrase.trim();
    if (trimmed) phrases.push(trimmed);
    return ' ';
  });

  type Atom = { kind: 'exact' | 'word' | 'or'; value: string };
  const atoms: Atom[] = [];
  for (const token of rest.split(/\s+/).filter(Boolean)) {
    if (token.toUpperCase() === 'OR') {
      atoms.push({ kind: 'or', value: 'OR' });
      continue;
    }
    if (token.startsWith('!') && token.length > 1) {
      atoms.push({ kind: 'exact', value: token.slice(1) });
      continue;
    }
    // «как-то», «отпуск,» → отдельные слова без пунктуации
    for (const word of tokenizeKnowledgeText(token)) atoms.push({ kind: 'word', value: word });
  }

  const exact: string[] = [];
  const orGroups: string[][] = [];
  const soft: string[] = [];
  const stop: string[] = [];

  let i = 0;
  while (i < atoms.length) {
    const current = atoms[i];
    if (!current || current.kind === 'or') {
      i += 1;
      continue;
    }
    if (atoms[i + 1]?.kind === 'or' && atoms[i + 2] && atoms[i + 2].kind !== 'or') {
      const group = [current.value];
      let j = i + 1;
      while (atoms[j]?.kind === 'or' && atoms[j + 1] && atoms[j + 1].kind !== 'or') {
        group.push(atoms[j + 1].value);
        j += 2;
      }
      const meaningful = group.filter((w) => !isKnowledgeStopWord(w));
      if (meaningful.length) orGroups.push(meaningful);
      i = j;
      continue;
    }
    if (current.kind === 'exact') exact.push(current.value);
    else if (isKnowledgeStopWord(current.value)) stop.push(current.value);
    else if (!soft.includes(current.value)) soft.push(current.value);
    i += 1;
  }

  return { phrases, exact, orGroups, soft, stop };
}

/** В запросе есть текст, но только служебные слова («в», «и на по»). */
export function isStopWordsOnlyQuery(raw: string): boolean {
  if (!raw.trim()) return false;
  const p = parseKnowledgeQuery(raw);
  return !p.phrases.length && !p.exact.length && !p.orGroups.length && !p.soft.length && p.stop.length > 0;
}

/* ── Индекс: основа слова → статьи ── */

const F_BODY = 1;
const F_META = 2;
const F_TITLE = 4;
const W_TITLE = 10;
const W_META = 5;
const W_BODY = 2;

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ');

type SearchIndex = {
  cards: readonly KnowledgeCard[];
  /** основа → (индекс статьи → биты полей | число вхождений в тексте << 3) */
  postings: Map<string, Map<number, number>>;
  vocab: string[];
  /** Нормализованный полный текст — для "фраз" и !точных слов. */
  texts: string[];
  /** Кэш: основа запроса → подходящие основы словаря с качеством совпадения. */
  termCache: Map<string, [string, number][]>;
};

const indexCache = new WeakMap<object, SearchIndex>();

const cardMeta = (card: KnowledgeCard) =>
  [card.category, ...(card.tags ?? []), ...(card.breadcrumbs ?? []), card.description].join('\n');

const cardBody = (card: KnowledgeCard) =>
  [card.author ?? '', ...(card.body ?? []), stripHtml(card.bodyHtml ?? '')].join('\n');

function buildIndex(cards: readonly KnowledgeCard[]): SearchIndex {
  const postings = new Map<string, Map<number, number>>();
  const texts: string[] = [];
  const add = (stem: string, idx: number, field: number) => {
    let row = postings.get(stem);
    if (!row) {
      row = new Map();
      postings.set(stem, row);
    }
    const prev = row.get(idx) ?? 0;
    row.set(idx, field === F_BODY ? (prev | F_BODY) + 8 : prev | field);
  };
  cards.forEach((card, idx) => {
    const title = card.title ?? '';
    const meta = cardMeta(card);
    const body = cardBody(card);
    texts.push(norm(`${title}\n${meta}\n${body}`));
    for (const w of tokenizeKnowledgeText(title)) add(stemRu(w), idx, F_TITLE);
    for (const w of tokenizeKnowledgeText(meta)) add(stemRu(w), idx, F_META);
    for (const w of tokenizeKnowledgeText(body)) add(stemRu(w), idx, F_BODY);
  });
  return { cards, postings, vocab: [...postings.keys()], texts, termCache: new Map() };
}

function getIndex(cards: readonly KnowledgeCard[]): SearchIndex {
  const cached = indexCache.get(cards);
  if (cached && cached.cards.length === cards.length && cached.cards.every((c, i) => c === cards[i])) {
    return cached;
  }
  const built = buildIndex(cards.slice());
  indexCache.set(cards, built);
  return built;
}

const commonPrefix = (a: string, b: string) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i += 1;
  return i;
};

/**
 * Основы словаря, совпадающие с основой запроса.
 * 1 — та же основа; 0.85 — основа-продолжение («увол» → «увольнен»);
 * 0.75 — словарь короче запроса («отпускн» ← «отпуск»); 0.7 — общий длинный корень
 * («переговорк» / «переговорн»). Короткие слова (зп, вк, seo) — только точное совпадение.
 */
function matchStem(index: SearchIndex, stem: string): [string, number][] {
  const cached = index.termCache.get(stem);
  if (cached) return cached;
  const out: [string, number][] = [];
  if (index.postings.has(stem)) out.push([stem, 1]);
  if (stem.length >= 4) {
    for (const v of index.vocab) {
      if (v === stem) continue;
      if (v.length > stem.length) {
        if (v.startsWith(stem) && v.length - stem.length <= 4) out.push([v, 0.85]);
        else if (stem.length >= 5) {
          const cp = commonPrefix(v, stem);
          if (cp >= 5 && cp >= stem.length - 1) out.push([v, 0.7]);
        }
      } else if (v.length >= 4) {
        if (stem.startsWith(v) && stem.length - v.length <= 3) out.push([v, 0.75]);
        else if (v.length >= 5) {
          const cp = commonPrefix(v, stem);
          if (cp >= 5 && cp >= v.length - 1 && cp >= stem.length - 1) out.push([v, 0.7]);
        }
      }
    }
  }
  if (index.termCache.size > 2000) index.termCache.clear();
  index.termCache.set(stem, out);
  return out;
}

/** Основы для одного слова запроса: само слово, транслит/раскладка, узкие синонимы. */
function termStems(word: string): [string, number][] {
  const out = new Map<string, number>();
  const put = (stem: string, q: number) => {
    if (stem && (out.get(stem) ?? 0) < q) out.set(stem, q);
  };
  const variants = expandToken(word);
  variants.forEach((v, i) => put(stemRu(v), i === 0 ? 1 : 0.9));
  for (const syn of synonymsOf(word)) put(stemRu(syn), 0.85);
  return [...out];
}

type TermMatch = Map<number, { score: number; stems: Set<string> }>;

function matchTerm(index: SearchIndex, words: string[]): TermMatch {
  const perCard: TermMatch = new Map();
  for (const word of words) {
    for (const [qStem, qQuality] of termStems(word)) {
      for (const [stem, quality] of matchStem(index, qStem)) {
        const row = index.postings.get(stem);
        if (!row) continue;
        const q = qQuality * quality;
        for (const [idx, packed] of row) {
          let fieldScore = 0;
          if (packed & F_TITLE) fieldScore = W_TITLE;
          else if (packed & F_META) fieldScore = W_META;
          if (packed & F_BODY) {
            const count = packed >> 3;
            fieldScore = Math.max(fieldScore, W_BODY + Math.min(count, 6) * 0.25);
          }
          const s = fieldScore * q;
          const prev = perCard.get(idx);
          if (!prev) perCard.set(idx, { score: s, stems: new Set([stem]) });
          else {
            prev.stems.add(stem);
            if (s > prev.score) prev.score = s;
          }
        }
      }
    }
  }
  return perCard;
}

/** Подсветка: слова заголовка, чья основа совпала с запросом. */
export function highlightTitle(title: string, stems: ReadonlySet<string>) {
  if (!stems.size) return [{ text: title, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of title.matchAll(WORD_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: title.slice(last, at), hit: false });
    parts.push({ text: m[0], hit: stems.has(stemRu(norm(m[0]))) });
    last = at + m[0].length;
  }
  if (last < title.length) parts.push({ text: title.slice(last), hit: false });
  // склеиваем соседние куски без подсветки
  return parts.reduce<{ text: string; hit: boolean }[]>((acc, part) => {
    const prev = acc[acc.length - 1];
    if (prev && !prev.hit && !part.hit) prev.text += part.text;
    else acc.push({ ...part });
    return acc;
  }, []);
}

export function applyKnowledgeFilters(cards: readonly KnowledgeCard[], filters: KnowledgeSearchFilters) {
  return cards.filter((card) => {
    if (card.tone === 'placeholder') return false;
    // visibility/departments уже отфильтрованы на сервере (/api/knowledge)
    if (filters.author && card.author !== filters.author) return false;
    if (filters.topic && card.category !== filters.topic) return false;
    if (filters.type && card.type !== filters.type) return false;
    if (filters.dateFrom && (card.publishedAt ?? '') < filters.dateFrom) return false;
    if (filters.dateTo && (card.publishedAt ?? '') > filters.dateTo) return false;
    return true;
  });
}

const byDate = (a: KnowledgeCard, b: KnowledgeCard) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');

export function searchKnowledgeArticles(
  cards: readonly KnowledgeCard[],
  rawQuery: string,
  filters: KnowledgeSearchFilters
): KnowledgeHit[] {
  const pool = applyKnowledgeFilters(cards, filters);
  const parsed = parseKnowledgeQuery(rawQuery.trim());
  const termGroups: string[][] = [...parsed.soft.map((w) => [w]), ...parsed.orGroups];
  const hasRequired = parsed.phrases.length + parsed.exact.length > 0;

  // Пустой запрос или только служебные слова — обычный список по дате
  if (!termGroups.length && !hasRequired) {
    return pool
      .slice()
      .sort(byDate)
      .map((card) => ({ card, score: 0, matched: 0, termCount: 0, titleParts: [{ text: card.title, hit: false }] }));
  }

  const index = getIndex(cards);
  const inPool = new Set(pool.map((c) => c.id));
  const termCount = termGroups.length;
  const matches = termGroups.map((words) => matchTerm(index, words));
  // Частичные совпадения допускаем, но для длинных запросов — хотя бы половина слов
  const minMatched = termCount <= 2 ? 1 : Math.ceil(termCount / 2);
  const phraseNorm = parsed.phrases.map((p) => expandToken(p));
  const phraseStems = parsed.phrases.flatMap((p) => meaningfulQueryWords(p).map((w) => stemRu(w)));
  const exactStems = parsed.exact.map((w) => stemRu(norm(w)));

  const hits: KnowledgeHit[] = [];
  index.cards.forEach((card, idx) => {
    if (!inPool.has(card.id)) return;
    const text = index.texts[idx]!;
    const titleNorm = norm(card.title);

    let score = 0;
    for (const variants of phraseNorm) {
      if (variants.some((v) => titleNorm.includes(v))) score += 12;
      else if (variants.some((v) => text.includes(v))) score += 6;
      else return;
    }
    for (const word of parsed.exact) {
      if (!expandToken(word).some((v) => hasExactWord(text, v))) return;
      score += expandToken(word).some((v) => hasExactWord(titleNorm, v)) ? 10 : 5;
    }

    let matched = 0;
    let inTitle = 0;
    const stems = new Set<string>([...phraseStems, ...exactStems]);
    for (const m of matches) {
      const hit = m.get(idx);
      if (!hit) continue;
      matched += 1;
      score += hit.score;
      if (hit.score >= W_TITLE * 0.7) inTitle += 1;
      for (const s of hit.stems) stems.add(s);
    }
    if (termCount && matched < minMatched) return;
    if (!termCount && !hasRequired) return;
    // Все слова запроса в заголовке — почти наверняка та самая статья
    if (termCount > 1 && inTitle === termCount) score += 6;

    hits.push({ card, score, matched, termCount, titleParts: highlightTitle(card.title, stems) });
  });

  return hits.sort((a, b) => {
    if (b.matched !== a.matched) return b.matched - a.matched;
    if (b.score !== a.score) return b.score - a.score;
    return byDate(a.card, b.card);
  });
}

const AI_SOFT_STOP = KNOWLEDGE_STOP_WORDS;

/** Сколько «смысловых» слов запроса реально встречаются в статье (с учётом словоформ/транслита). */
export function countSoftTokenMatches(card: KnowledgeCard, softTokens: string[]): number {
  let index = indexCache.get(card);
  if (!index) {
    index = buildIndex([card]);
    indexCache.set(card, index);
  }
  let n = 0;
  for (const raw of softTokens) {
    const token = norm(raw.trim());
    if (!token || AI_SOFT_STOP.has(token) || token.length < 2) continue;
    if (matchTerm(index, [token]).size) n += 1;
  }
  return n;
}

/**
 * Отбор статей для чата ИИ: строже обычного поиска страницы.
 * Обычный поиск поднимает всё, где есть хоть одно слово («контакты» в регламенте SEO) —
 * для контекста модели оставляем только хиты с несколькими совпадениями / сильным score.
 */
export function pickKnowledgeCardsForAi(cards: KnowledgeCard[], question: string, limit = 3): KnowledgeCard[] {
  const ranked = searchKnowledgeArticles(cards, question, emptyKnowledgeFilters());
  const softMeaningful = parseKnowledgeQuery(question).soft;

  const minTokenHits =
    softMeaningful.length <= 1 ? 1 : Math.min(softMeaningful.length, Math.max(2, Math.ceil(softMeaningful.length * 0.6)));
  /** Одно слово в теле даёт ~2–3.5; совпадение в заголовке ≥ 7. */
  const minScore = softMeaningful.length <= 1 ? 2 : 5;

  const strict = ranked.filter((hit) => hit.score >= minScore && hit.matched >= minTokenHits);

  if (strict.length) {
    return strict.slice(0, limit).map((hit) => hit.card);
  }

  // Мягкий откат: только лучший хит, и только если он не «одно слово в хвосте статьи»
  const top = ranked[0];
  if (top && top.score >= 5) {
    return [top.card];
  }

  return [];
}
