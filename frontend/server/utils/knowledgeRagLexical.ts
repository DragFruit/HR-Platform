/** Словесный слой для гибридного RAG (сервер). */

import { stemRu } from '../../app/utils/ruStem';

/** Стеммер общий с обычным поиском по базе знаний (app/utils/ruStem.ts). */
export { stemRu };

const STOP = new Set([
  'и',
  'в',
  'на',
  'по',
  'для',
  'как',
  'что',
  'это',
  'или',
  'из',
  'к',
  'о',
  'об',
  'а',
  'но',
  'не',
  'ни',
  'же',
  'ли',
  'бы',
  'то',
  'я',
  'мы',
  'вы',
  'он',
  'она',
  'они',
  'мне',
  'меня',
  'мой',
  'моя',
  'можно',
  'нужно',
  'есть',
  'быть',
  'где',
  'когда',
  'какой',
  'какая',
  'какие',
  'кто',
  'чем',
  'чтобы',
  'если',
  'уже',
  'еще',
  'ещё',
  'просто',
  'пожалуйста',
  'подскажи',
  'скажи',
  'расскажи'
]);

/**
 * Секции справочника «Контакты» (kb-20409): якоря блоков, не общие слова вроде «агентства».
 * Токен из группы → hard retrieval + бонус за короткую шапку секции.
 */
const CONTACT_SECTION_GROUPS: string[][] = [
  ['программатик', 'программатика', 'программатики', 'programmatic'],
[
    'юрист',
    'юриста',
    'юристу',
    'юристы',
    'юристов',
    'юридическая',
    'юридической',
    'юридическую'
  ],
  ['дизайнер', 'дизайнера', 'дизайнеру', 'дизайнеры', 'дизайнеров'],
  [
    'перевод',
    'перевода',
    'переводов',
    'переводчик',
    'переводчика',
    'переводчику',
    'переводчики',
    'переводчиков',
    'elefteria'
  ],
  ['яндекс', 'яндекса', 'яндексе', 'яндексу', 'yandex'],
  ['google360', 'google 360'],
  ['click', 'clickru', 'click.ru'],
  ['аэропорт', 'аэропортах', 'аэропорту', 'телевизор', 'телевизоре', 'наружная']
];

/** Слабые «редкие» слова: не выбирать якорем, если есть секция Контактов. */
const WEAK_RARE_ANCHORS = new Set([
  'контакты',
  'контакт',
  'менеджера',
  'менеджер',
  'агентства',
  'агентство',
  'расчетов',
  'расчётов',
  'телефон',
  'телефоны',
  'справочник',
  'регламент',
  'регламента'
]);

/**
 * Короткие латинские продуктовые якоря (длина < 4): иначе «utm» выпадает из distinctive
 * и «регламент utm» уезжает в найм/SEO.
 */
const SHORT_PRODUCT_TOKENS = new Set(['utm', 'uis', 'vk', 'vkr', 'smm', 'ppc']);

/** Вопрос про справочник «кому писать / контакты», а не про регламент площадки. */
export function hasContactDirectoryIntent(question: string): boolean {
  const q = String(question || '').toLowerCase().replace(/ё/g, 'е');
  if (!q) return false;
  if (hasActsRegulationIntent(q) || hasWriteoffAfinaIntent(q)) return false;
  return /(контакт|кому\s+писать|написать|телефон|почт|e-?mail|связаться|справочник|для расчетов|для расчётов|менеджер[аеу]?\s+(яндекс|yandex)|(?:яндекс|yandex)\s+менеджер)/i.test(
    q
  );
}

/**
 * Регламент UTM / коллтрекинг-метки — не гостевые доступы Calltouch и не Контакты.
 * «доступ к Calltouch» / «гостевые» → false.
 */
export function hasUtmTaggingIntent(question: string): boolean {
  const q = String(question || '').toLowerCase().replace(/ё/g, 'е');
  if (!q) return false;
  if (/(гостев|выдат\w*\s+доступ|доступ\s+к\b)/i.test(q) && !/\butm\b|тегир|размет/i.test(q)) {
    return false;
  }
  return (
    /\butm\b|utm_|тегирован|размечать|разметк|коллтрек|колтрек/i.test(q) ||
    /(uis|roistat|calltouch|comagic)/i.test(q)
  );
}

/** Якорь UTM/коллтрекинга для hard prefer kb-23420. */
export function isUtmSectionToken(token: string): boolean {
  const t = token.toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  if (SHORT_PRODUCT_TOKENS.has(t) && (t === 'utm' || t === 'uis')) return true;
  return /utm|uis|roistat|calltouch|comagic|коллтрек|колтрек|тегирован|разметк/i.test(t);
}

/**
 * Акты от РП (YDirect / VKR / Add Cost SMM) — kb-31980, не «Контакты» про Яндекс-менеджера.
 * «актуально» без слова «акт/акты» — false.
 */
export function hasActsRegulationIntent(question: string): boolean {
  const q = String(question || '').toLowerCase().replace(/ё/g, 'е');
  if (!q) return false;
  if (/ydirect|add\s*cost/i.test(q)) return true;
  const withoutActual = q.replace(/актуальн\w*/gi, ' ');
  // не полагаемся на [^а-я] (без unicode-флага в части рантаймов)
  return /(?:^|[\s,.:;!?«»"(\[])акт(?:ы|ов|а|у|ам|ами)?(?=$|[\s,.:;!?»")\]])/i.test(
    withoutActual
  );
}

/** Якорь секции актов / площадок в kb-31980. */
export function isActsSectionToken(token: string): boolean {
  const t = token.toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  if (SHORT_PRODUCT_TOKENS.has(t) && (t === 'vkr' || t === 'smm')) return true;
  return /акт|ydirect|vkr|яндекс|yandex|директ|addcost|марж|преми/i.test(t);
}

/**
 * Списания в AFINA (комиссии / прочее / доп.расходы) — kb-28468.
 * Не путать с «акты …» (те → hasActsRegulationIntent) и не с «доступы к afina».
 */
export function hasWriteoffAfinaIntent(question: string): boolean {
  const q = String(question || '').toLowerCase().replace(/ё/g, 'е');
  if (!q) return false;
  if (hasActsRegulationIntent(q) && !/списан|прочее\s*\(?\s*ppc|доп\.?\s*расход/i.test(q)) {
    return false;
  }
  if (/доступ/i.test(q) && !/списан/i.test(q)) return false;
  return (
    /списан/i.test(q) ||
    /прочее\s*\(?\s*ppc/i.test(q) ||
    /доп\.?\s*расход/i.test(q) ||
    (/комисси/i.test(q) && /(afina|афин|правил|прочее)/i.test(q)) ||
    /рекламн\w*\s+сбор/i.test(q)
  );
}

/** Якорь списаний AFINA. */
export function isWriteoffSectionToken(token: string): boolean {
  const t = token.toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  if (SHORT_PRODUCT_TOKENS.has(t) && (t === 'ppc' || t === 'smm')) return true;
  return /списан|комисси|прочее|afina|афин|геосервис|копилк|сбор/i.test(t);
}

/** Якорь-продукт справочника — можно без «контакты» в формулировке. */
function isProductLikeContactAnchor(token: string): boolean {
  const t = token.toLowerCase();
  return /programmatic|программатик|click|google|elefteria|яндекс|yandex|аэропорт|телевизор|наружн/i.test(
    t
  );
}

/** Пары/группы близких формулировок (осторожное расширение, без смены темы). */
const SYNONYM_GROUPS: string[][] = [
  // Написание SaaS (без «отгул» — смысл вопроса разбирает knowledgeRagSense)
  ['dayofff', 'day offf', 'dayoff', 'day off', 'дейофф', 'дей офф', 'дейоф', 'дей оф'],
  ['отгул', 'отгулы', 'оформления отгулов'],
  ['afina', 'афина', 'афину', 'афине', 'афины'],
  ['акты', 'акт', 'ydirect', 'vkr', 'add cost'],
  [
    'списания',
    'списание',
    'списаний',
    'комиссии',
    'комиссия',
    'прочее ppc',
    'доп расходы',
    'дополнительные расходы'
  ],
  [
    'гостевой',
    'гостевые',
    'гостевых',
    'гостевого',
    'гостевым',
    'гостевая',
    'гостевую'
  ],
  [
    'utm',
    'utm_source',
    'тегирования',
    'тегирование',
    'разметка',
    'разметки',
    'размечать',
    'коллтрекинг',
    'колтрекинг',
    'calltouch',
    'roistat',
    'uis',
    'comagic'
  ],
  ['vpn', 'впн'],
  ['отпуск раньше', 'аванс отпуска', 'раньше в отпуск', 'уйти раньше в отпуск'],
  ['больничный', 'больничн'],
  ['пароль', 'пароля', 'логин'],
  ['регламент отпуска', 'ухода в отпуск', 'правила отпуска'],
  ['дни рождения', 'день рождения', 'др клиентов', 'др клиента', 'др клиент', 'birthday'],
  ...CONTACT_SECTION_GROUPS,
  // Сотрудник спрашивает «как уволиться» — то же, что регламент/процесс увольнения
  [
    'увольнение',
    'увольнения',
    'увольнении',
    'уволиться',
    'уволится',
    'уволюсь',
    'увольняюсь',
    'процесс увольнения',
    'регламент увольнения',
    'как уволиться',
    'как уволится',
    'хочу уволиться',
    'хочу уволится',
    'что нужно чтобы уволиться'
  ],
  ['ecom', 'e-commerce', 'ecommerce', 'еком', 'екомерс', 'екоммерс', 'эком'],
  ['smm', 'смм', 'таргет', 'таргетированная', 'посевы', 'посев'],
  ['кейс', 'кейсы', 'case study', 'case studies'],
  [
    'корп шрифты',
    'корпоративные шрифты',
    'корпоративный шрифт',
    'наши шрифты',
    'какие у нас шрифты',
    'шрифт компании',
    'шрифты компании',
    'шрифты vbi',
    'фирменный шрифт',
    'ховес про триал',
    'ховес про',
    'tt hoves pro trial',
    'tt hoves pro',
    'tt hoves',
    'hoves'
  ]
];

/** Корпоративные шрифты VBI (TT Hoves) — kb-corp-fonts-vbi. */
export function hasCorpFontsIntent(question: string): boolean {
  const q = String(question || '').toLowerCase().replace(/ё/g, 'е');
  if (!q) return false;
  if (/шрифт[а-яё]*\s+компан|компан[а-яё]*\s+шрифт/i.test(q)) return true;
  return (
    /(?<![а-яёa-z0-9])(?:шрифт[а-яё]*|типограф[а-яё]*|hoves|tt\s*hoves|брендбук|фирменн[а-яё]*\s+шрифт|корпоративн[а-яё]*\s+шрифт)(?![а-яёa-z0-9])/iu.test(
      q
    ) || /\btt\s*hoves\b/i.test(q)
  );
}

/** Якорь запроса про шрифты / TT Hoves. */
export function isFontSectionToken(token: string): boolean {
  const t = token.toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  if (/^шрифт|^hoves|^типограф|^tt$/.test(t)) return true;
  return /hoves|типограф|шрифт/.test(t);
}

/**
 * Расширение под двусмысленный «дейоф»:
 * - «взять дейоф» → +отгул
 * - «войти в дейоф» → +dayofff / система
 * - неясно → оба направления, чтобы retrieval увидел оба смысла
 */
export function expandDayoffBySense(question: string, guess: 'leave' | 'saas' | 'ambiguous' | 'none'): string {
  const q = question.trim();
  if (!q || guess === 'none') return q;
  if (guess === 'leave') return `${q} отгул оформить отгул`.replace(/\s+/g, ' ').trim();
  if (guess === 'saas') return `${q} dayofff система DayOFFF авторизация`.replace(/\s+/g, ' ').trim();
  // ambiguous: оба якоря в поисковой строке
  return `${q} отгул dayofff система DayOFFF`.replace(/\s+/g, ' ').trim();
}

export function tokenizeForRag(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/**
 * Кэши горячего пути лексического поиска (2026-10-19: фолбэк при сбое Yandex считал стеммер
 * для каждого слова каждой статьи заново — ~40 с синхронного CPU, event loop стоял, стейдж отдавал 504).
 * Результаты чистые (зависят только от входа) — кэшируем; при переполнении просто сбрасываем.
 */
const BLOB_WORDS_CACHE_MAX = 4_000;
const blobWordsCache = new Map<string, readonly string[]>();

/** Уникальные слова текста (tokenizeForRag без дублей) — для морфологического сравнения. */
export function uniqueRagWords(blob: string): readonly string[] {
  const hit = blobWordsCache.get(blob);
  if (hit) return hit;
  const words = [...new Set(tokenizeForRag(blob))];
  if (blobWordsCache.size >= BLOB_WORDS_CACHE_MAX) blobWordsCache.clear();
  blobWordsCache.set(blob, words);
  return words;
}

/** Одна словоформа? Точное вхождение или общая основа (увол / увольн). */
const MORPH_CACHE_MAX = 200_000;
const morphCache = new Map<string, boolean>();

export function tokensMatchMorph(a: string, b: string): boolean {
  const key = `${a}\u0000${b}`;
  const cached = morphCache.get(key);
  if (cached !== undefined) return cached;
  const out = tokensMatchMorphUncached(a, b);
  if (morphCache.size >= MORPH_CACHE_MAX) morphCache.clear();
  morphCache.set(key, out);
  return out;
}

function tokensMatchMorphUncached(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/ё/g, 'е');
  const y = b.toLowerCase().replace(/ё/g, 'е');
  if (x === y) return true;
  if (x.length < 4 || y.length < 4) return x.includes(y) || y.includes(x);
  // «ь» в основе часто мешает префиксу (увол vs увольн)
  const sa = stemRu(x).replace(/ь/g, '');
  const sb = stemRu(y).replace(/ь/g, '');
  if (sa === sb) return true;
  if (sa.length < 4 || sb.length < 4) return false;
  const [shortStem, longStem] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  if (!longStem.startsWith(shortStem)) return false;
  const extra = longStem.slice(shortStem.length);
  // хвост стеммера (увол / уволнен), не другая лексема (привет / приветств)
  return /^(н|ен|ени|нн|ок|к|ск|т|л|вш|ющ|ива|ыва)*$/u.test(extra);
}

/** Токен из блока справочника «Контакты» (юрист / яндекс / programmatic …). */
export function isContactSectionToken(token: string): boolean {
  const t = token.toLowerCase().replace(/ё/g, 'е');
  if (!t || t.length < 4) return false;
  for (const group of CONTACT_SECTION_GROUPS) {
    for (const term of group) {
      const g = term.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, '');
      if (g.length < 4) continue;
      if (t === g || t.includes(g) || g.includes(t)) return true;
      if (tokensMatchMorph(t, g)) return true;
    }
  }
  return false;
}

function synonymGroupForToken(token: string): string[] | null {
  const t = token.toLowerCase();
  for (const group of SYNONYM_GROUPS) {
    if (group.some((term) => term.toLowerCase() === t || t.includes(term.toLowerCase()))) {
      return group;
    }
  }
  return null;
}

function hasWholeWordToken(blob: string, token: string): boolean {
  const t = String(token || '')
    .toLowerCase()
    .replace(/ё/g, 'е');
  if (!t || !blob) return false;
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`,
    'iu'
  );
  return re.test(blob);
}

/**
 * Короткие токены-префиксы: нельзя `blob.includes('авто')` → «авторизация» / «автоматически».
 * «авито» при этом не содержит «авто» как целое слово.
 */
const PREFIX_AMBIGUOUS_TOKENS = new Set(['авто', 'акт', 'utm']);

export function textCoversToken(text: string, token: string): boolean {
  const t = token.toLowerCase().replace(/ё/g, 'е');
  const blob = String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е');
  if (!t) return true;

  // Целое слово — основной путь (авто ≠ авторизация ≠ авито)
  if (hasWholeWordToken(blob, t)) return true;

  // Авто-сегмент: сложные формы без пробела
  if (t === 'авто' && /авто(мобил|тематик|салон|дилер|сервис|рынок|кейс)/i.test(blob)) {
    return true;
  }

  // Старый includes — только для длинных токенов без prefix-ловушки
  if (!PREFIX_AMBIGUOUS_TOKENS.has(t) && t.length >= 5 && blob.includes(t)) {
    return true;
  }

  if (t.length < 4) return false;
  if (uniqueRagWords(blob).some((w) => tokensMatchMorph(w, t))) return true;
  const group = synonymGroupForToken(t);
  if (!group) return false;
  return group.some((term) => {
    const g = term.toLowerCase().replace(/ё/g, 'е');
    if (g === t) return false;
    if (hasWholeWordToken(blob, g)) return true;
    if (!PREFIX_AMBIGUOUS_TOKENS.has(g) && g.length >= 5 && blob.includes(g)) return true;
    return uniqueRagWords(blob).some((w) => tokensMatchMorph(w, g));
  });
}

/** Слишком общие слова — по ним нельзя оставлять «похожие» статьи. */
const GENERIC_QUERY_TOKENS = new Set([
  'могу',
  'посмотреть',
  'найти',
  'узнать',
  'сделать',
  'открыть',
  'клиент',
  'клиента',
  'клиенты',
  'клиентов',
  'клиентам',
  'сотрудник',
  'сотрудника',
  'сотрудники',
  'сотрудников',
  'проект',
  'проекта',
  'проекты',
  'проектов',
  'система',
  'раздел',
  'страница',
  'инструкция',
  'информация',
  'лучше',
  'писать',
  'кому',
  'какой',
  'какая',
  'какие',
  'есть',
  'компании',
  'компания',
  'компанию',
  'компанией'
]);

/**
 * Значимые токены запроса (после синонимов).
 * Если ни одна статья их не покрывает — лучше пустой retrieval, чем чужие «клиенты/CRM».
 */
export function distinctiveQueryTokens(question: string): string[] {
  return tokenizeForRag(question).filter((t) => {
    if (GENERIC_QUERY_TOKENS.has(t)) return false;
    if (t.length >= 4) return true;
    return SHORT_PRODUCT_TOKENS.has(t.toLowerCase());
  });
}

/** Редкие якоря запроса: секции Контактов, UTM, акты, списания, продукт-синонимы, длинные слова, латиница. */
export function rareDistinctiveTokens(distinctive: string[]): string[] {
  return distinctive.filter((t) => {
    if (
      isContactSectionToken(t) ||
      isUtmSectionToken(t) ||
      isActsSectionToken(t) ||
      isWriteoffSectionToken(t) ||
      isFontSectionToken(t)
    ) {
      return true;
    }
    if (t.length >= 8 || /[a-z]/i.test(t)) return true;
    // «афину» (5) — в группе с afina; иначе hard path не видит якорь
    const group = synonymGroupForToken(t);
    return Boolean(group && group.some((g) => /[a-z]/i.test(g) || g.length >= 8));
  });
}

export function longestRareToken(distinctive: string[], question = ''): string | null {
  const rare = rareDistinctiveTokens(distinctive);
  if (!rare.length) return null;
  const withoutWeak = rare.filter((t) => !WEAK_RARE_ANCHORS.has(t.toLowerCase()));
  const pool = withoutWeak.length ? withoutWeak : rare;
  const contactIntent = hasContactDirectoryIntent(question);
  const utmIntent = hasUtmTaggingIntent(question);
  const actsIntent = hasActsRegulationIntent(question);
  const writeoffIntent = hasWriteoffAfinaIntent(question);
  const fontsIntent = hasCorpFontsIntent(question);
  if (fontsIntent) {
    const font = pool.filter((t) => isFontSectionToken(t));
    if (font.length) {
      return [...font].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]!;
    }
  }
  const contact = pool.filter((t) => {
    if (!isContactSectionToken(t)) return false;
    if (isProductLikeContactAnchor(t)) return true;
    return contactIntent;
  });
  if (utmIntent) {
    const utm = pool.filter((t) => isUtmSectionToken(t));
    if (utm.length) {
      return [...utm].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]!;
    }
  }
  if (actsIntent) {
    const acts = pool.filter((t) => isActsSectionToken(t));
    // «акты яндекс» — не брать якорь «яндекс» (блок Контактов), а слово «акты»
    const actWord = acts.filter((t) => /^акт/i.test(t));
    const useActs = actWord.length ? actWord : acts;
    if (useActs.length) {
      return [...useActs].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]!;
    }
  }
  if (writeoffIntent) {
    const wo = pool.filter((t) => isWriteoffSectionToken(t));
    if (wo.length) {
      return [...wo].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]!;
    }
  }
  const use = contact.length ? contact : pool;
  return [...use].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]!;
}

/**
 * Варианты латинского бренда с кириллическими lookalike (Calltouсh в статье UTM).
 * Не трогаем целиком русский текст — только формы якоря.
 */
function latinLookalikeForms(token: string): string[] {
  const t = String(token || '')
    .toLowerCase()
    .replace(/ё/g, 'е');
  if (!t || !/^[a-z0-9_.-]+$/i.test(t)) return [t];
  const pairs: [RegExp, string][] = [
    [/c/g, 'с'],
    [/e/g, 'е'],
    [/o/g, 'о'],
    [/a/g, 'а'],
    [/p/g, 'р'],
    [/y/g, 'у'],
    [/x/g, 'х'],
    [/k/g, 'к'],
    [/m/g, 'м'],
    [/t/g, 'т'],
    [/h/g, 'н'],
    [/b/g, 'в']
  ];
  const out = new Set<string>([t]);
  let mixed = t;
  for (const [re, ch] of pairs) mixed = mixed.replace(re, ch);
  if (mixed !== t) out.add(mixed);
  // частый кейс: только «с» вместо c (Calltouсh)
  if (t.includes('c')) out.add(t.replace(/c/g, 'с'));
  return [...out].filter(Boolean);
}

/** Целое слово (не «программатик» внутри «программатики»). */
function forEachWholeWord(blob: string, form: string, fn: (idx: number) => void): void {
  if (!form || form.length < 4) return;
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`,
    'giu'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    fn(m.index);
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
}

/**
 * Насколько «якорь» сидит в тексте: 1 = вскользь (как programmatic в DayOfff),
 * ≥2 = заголовок секции / несколько вхождений (блок в Контактах).
 */
export function rareTokenStrength(text: string, token: string): number {
  if (!token || !text) return 0;
  const blob = String(text)
    .toLowerCase()
    .replace(/ё/g, 'е');
  const forms = new Set<string>(latinLookalikeForms(token));
  const group = synonymGroupForToken(token);
  if (group) {
    for (const g of group) {
      for (const f of latinLookalikeForms(g.replace(/\s+/g, ''))) forms.add(f);
    }
  }

  let score = 0;
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    if (form.includes(' ')) continue;
    forEachWholeWord(blob, form, (idx) => {
      score += 1;
      if (isRareAnchorHeadingAt(blob, form, idx)) score += 2;
    });
  }
  return score;
}

/**
 * Шапка блока в «Контактах»: «Programmatic…», «Дизайнеры», «Бюро переводов / …».
 * Не список PPC («ads, programmatic,»), не регламент и не предложение mid-body.
 */
function isRareAnchorHeadingAt(blob: string, form: string, idx: number): boolean {
  const lineStart = blob.lastIndexOf('\n', Math.max(0, idx - 1)) + 1;
  const after = blob[idx + form.length] || '';
  if (after === ',') return false;
  const lineEnd = blob.indexOf('\n', idx);
  const rawLine = blob.slice(lineStart, lineEnd < 0 ? blob.length : lineEnd);
  const leadWs = (rawLine.match(/^\s*/) || [''])[0].length;
  const col = idx - lineStart - leadWs;
  const line = rawLine.trim();
  if (!line) return false;
  if (/^[-•*–—]\s/.test(line)) return false;
  // Регламенты/инструкции — не секция справочника контактов
  if (/^(регламент|инструкция|правила |чек.?лист|как )\b/iu.test(line)) return false;
  if (/^\d+[\.)]/.test(line)) return false;
  if (/@|\+7|https?:/i.test(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);

  // «Юридическая поддержка / Юристы», «Бюро переводов / переводчики»
  if (line.length <= 72 && line.includes('/') && words.length <= 10) return true;

  if (col > 2) {
    // «Акты Яндекс» / «Акты ВКР» — якорь не в начале строки, но это шапка секции
    if (
      line.length <= 48 &&
      words.length <= 6 &&
      /^акты?\b/i.test(line) &&
      col <= 24
    ) {
      return true;
    }
    return false;
  }

  // Короткая шапка: «Дизайнеры», «Яндекс Менеджер», «CLICK RU»
  if (line.length <= 48 || words.length <= 4) return true;

  // Длинная строка с якорем в начале — латиница (Programmatic …) или кириллическая шапка секции
  if (/^[a-z0-9]/i.test(form)) return true;
  if (isContactSectionToken(form) && col <= 2 && words.length <= 12) return true;

  return false;
}

/** Сколько раз якорь в шапке секции (Контакты), а не mid-body / регламент. */
export function rareTokenHeadingHits(text: string, token: string): number {
  if (!token || !text) return 0;
  const blob = String(text)
    .toLowerCase()
    .replace(/ё/g, 'е');
  const forms = new Set<string>(latinLookalikeForms(token));
  const group = synonymGroupForToken(token);
  if (group) {
    for (const g of group) {
      for (const f of latinLookalikeForms(g.replace(/\s+/g, ''))) forms.add(f);
    }
  }
  let hits = 0;
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    if (form.includes(' ')) continue;
    forEachWholeWord(blob, form, (idx) => {
      if (isRareAnchorHeadingAt(blob, form, idx)) hits += 1;
    });
  }
  return hits;
}

export function hitCoversDistinctiveTokens(
  title: string,
  snippets: string[],
  distinctive: string[]
): boolean {
  if (!distinctive.length) return true;
  const blob = `${title}\n${snippets.join('\n')}`;
  const anchor = longestRareToken(distinctive);
  if (anchor) {
    // Обязателен самый специфичный якорь (programmatic), не «расчётов» из чужого блока
    return rareTokenStrength(blob, anchor) > 0;
  }
  const matched = distinctive.filter((t) => textCoversToken(blob, t));
  const need = Math.max(1, Math.ceil(distinctive.length * 0.4));
  return matched.length >= need;
}

/**
 * Доля совпавших токенов + бонус за заголовок (0…1).
 * Редкое точное слово в title поднимает score сильнее.
 * Совпадение — точное или по словоформе (основа).
 */
export function lexicalScore(title: string, body: string, queryTokens: string[]): number {
  if (!queryTokens.length) return 0;
  let hits = 0;
  let titleHits = 0;
  for (const token of queryTokens) {
    if (textCoversToken(title, token)) {
      hits += 1;
      titleHits += 1;
    } else if (textCoversToken(body, token)) {
      hits += 1;
    }
  }
  const coverage = hits / queryTokens.length;
  const titleBoost = titleHits / queryTokens.length;
  return Math.min(1, coverage * 0.75 + titleBoost * 0.45);
}

/** Добавляет синонимы к запросу, если в нём уже есть «якорь» группы. */
export function expandQueryWithSynonyms(question: string): string {
  const q = question.trim();
  if (!q) return q;
  const lower = q.toLowerCase();
  const extra: string[] = [];

  for (const group of SYNONYM_GROUPS) {
    const hit = group.some((term) => lower.includes(term.toLowerCase()));
    if (!hit) continue;
    for (const term of group) {
      if (!lower.includes(term.toLowerCase())) extra.push(term);
    }
  }

  if (!extra.length) return q;
  return `${q} ${extra.join(' ')}`.replace(/\s+/g, ' ').trim();
}

/**
 * Переформулировка безопасна, если сохраняет значимую долю исходных слов
 * и не раздувается новыми темами.
 */
export function isRewriteSafe(original: string, rewrite: string): boolean {
  const a = new Set(tokenizeForRag(original));
  const b = new Set(tokenizeForRag(rewrite));
  if (!a.size || !b.size) return false;

  let inter = 0;
  for (const t of a) {
    if (b.has(t)) inter += 1;
  }
  const recall = inter / a.size;
  const precision = inter / b.size;
  if (recall < 0.4) return false;
  if (precision < 0.35 && b.size > a.size * 1.5) return false;

  const lenRatio = rewrite.trim().length / Math.max(1, original.trim().length);
  if (lenRatio < 0.4 || lenRatio > 2.5) return false;
  return true;
}
