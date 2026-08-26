/** Словесный слой для гибридного RAG (сервер). */

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
const SHORT_PRODUCT_TOKENS = new Set(['utm', 'uis', 'vk']);

/** Вопрос про справочник «кому писать / контакты», а не про регламент площадки. */
export function hasContactDirectoryIntent(question: string): boolean {
  const q = String(question || '').toLowerCase().replace(/ё/g, 'е');
  if (!q) return false;
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
  ['dayofff', 'day offf', 'дейофф', 'дей офф'],
  ['отгул', 'отгулы', 'оформления отгулов'],
  ['afina', 'афина', 'афину', 'афине', 'афины'],
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
  ]
];

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

const RU_VOWELS = 'аеиоуыэюя';

const byLonger = (a: string, b: string) => b.length - a.length;

/** Стеммер по мотивам Snowball Russian — только для матчинга словоформ в RAG. */
export function stemRu(raw: string): string {
  let w = String(raw || '')
    .toLowerCase()
    .replace(/ё/g, 'е');
  if (w.length < 4 || !/[а-я]/.test(w)) return w;

  let rvStart = -1;
  for (let i = 0; i < w.length; i++) {
    if (RU_VOWELS.includes(w[i])) {
      rvStart = i + 1;
      break;
    }
  }
  if (rvStart < 0 || rvStart >= w.length) return w;
  const head = w.slice(0, rvStart);
  let rv = w.slice(rvStart);

  const cut = (endings: string[]): boolean => {
    for (const e of endings) {
      if (rv.length > e.length && rv.endsWith(e)) {
        rv = rv.slice(0, -e.length);
        return true;
      }
    }
    return false;
  };

  const cutAfterAYa = (endings: string[]): boolean => {
    for (const e of endings) {
      if (rv.length <= e.length + 1) continue;
      if (!rv.endsWith(e)) continue;
      const prev = rv[rv.length - e.length - 1];
      if (prev === 'а' || prev === 'я') {
        rv = rv.slice(0, -e.length);
        return true;
      }
    }
    return false;
  };

  if (
    !cut(['ившись', 'ывшись', 'ивши', 'ывши', 'ив', 'ыв'].sort(byLonger))
  ) {
    cutAfterAYa(['вшись', 'вши', 'в']);
  }
  cut(['ся', 'сь']);

  const adjectives = [
    'ившими',
    'ывшими',
    'его',
    'ого',
    'ему',
    'ому',
    'ими',
    'ыми',
    'ее',
    'ие',
    'ые',
    'ое',
    'ей',
    'ий',
    'ый',
    'ой',
    'ем',
    'им',
    'ым',
    'ом',
    'их',
    'ых',
    'ую',
    'юю',
    'ая',
    'яя',
    'ою',
    'ею'
  ].sort(byLonger);
  const partAfterAYa = ['ющ', 'вш', 'нн', 'ем', 'щ'].sort(byLonger);
  const part2 = ['ивши', 'ывши', 'ующ'].sort(byLonger);
  if (cut(adjectives)) {
    if (!cutAfterAYa(partAfterAYa)) cut(part2);
  } else if (!cutAfterAYa(partAfterAYa)) {
    cut(part2);
  }

  const verbAfterAYa = [
    'ете',
    'йте',
    'ешь',
    'нно',
    'ла',
    'на',
    'ли',
    'ло',
    'но',
    'ет',
    'ют',
    'ны',
    'ть',
    'й',
    'л',
    'ем',
    'н'
  ].sort(byLonger);
  // «уволится» → после снятия «ся» остаётся «уволит» (3 л. ед. ч.)
  const verb2 = [
    'ейте',
    'уйте',
    'ила',
    'ыла',
    'ена',
    'ите',
    'или',
    'ыли',
    'ено',
    'уют',
    'ены',
    'ить',
    'ыть',
    'ишь',
    'ит',
    'ят',
    'ат',
    'ую',
    'ю'
  ].sort(byLonger);
  if (!cutAfterAYa(verbAfterAYa)) cut(verb2);

  cut(
    [
      'иями',
      'ями',
      'ами',
      'иях',
      'ях',
      'иям',
      'ям',
      'ием',
      'ией',
      'ьев',
      'иях',
      'ей',
      'ой',
      'ий',
      'ие',
      'ье',
      'еи',
      'ии',
      'ев',
      'ов',
      'ом',
      'ем',
      'ах',
      'ию',
      'ью',
      'ия',
      'ья',
      'ам',
      'ия',
      'а',
      'е',
      'и',
      'й',
      'о',
      'у',
      'ы',
      'ь',
      'ю',
      'я'
    ].sort(byLonger)
  );

  cut(['ость', 'ост']);
  cut(['ейше', 'ейш']);
  if (rv.endsWith('нн') && rv.length > 2) rv = rv.slice(0, -1);
  if ((rv.endsWith('ь') || rv.endsWith('й')) && rv.length > 1) rv = rv.slice(0, -1);

  return `${head}${rv}`;
}

/** Одна словоформа? Точное вхождение или общая основа (увол / увольн). */
export function tokensMatchMorph(a: string, b: string): boolean {
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

export function textCoversToken(text: string, token: string): boolean {
  const t = token.toLowerCase();
  const blob = String(text || '').toLowerCase();
  if (!t) return true;
  if (blob.includes(t)) return true;
  if (t.length < 4) return false;
  if (tokenizeForRag(blob).some((w) => tokensMatchMorph(w, t))) return true;
  const group = synonymGroupForToken(t);
  if (!group) return false;
  return group.some((term) => {
    const g = term.toLowerCase();
    if (g === t) return false;
    if (blob.includes(g)) return true;
    return tokenizeForRag(blob).some((w) => tokensMatchMorph(w, g));
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
  'есть'
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

/** Редкие якоря запроса: секции Контактов, UTM, продукт-синонимы, длинные слова, латиница. */
export function rareDistinctiveTokens(distinctive: string[]): string[] {
  return distinctive.filter((t) => {
    if (isContactSectionToken(t) || isUtmSectionToken(t)) return true;
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

  if (col > 2) return false;

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
