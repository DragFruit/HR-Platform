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

/** Пары/группы близких формулировок (осторожное расширение, без смены темы). */
const SYNONYM_GROUPS: string[][] = [
  // Написание SaaS (без «отгул» — смысл вопроса разбирает knowledgeRagSense)
  ['dayofff', 'day offf', 'дейофф', 'дей офф'],
  ['отгул', 'отгулы', 'оформления отгулов'],
  ['afina', 'афина', 'афину', 'афине'],
  ['vpn', 'впн'],
  ['отпуск раньше', 'аванс отпуска', 'раньше в отпуск', 'уйти раньше в отпуск'],
  ['больничный', 'больничн'],
  ['пароль', 'пароля', 'логин'],
  ['регламент отпуска', 'ухода в отпуск', 'правила отпуска'],
  ['дни рождения', 'день рождения', 'др клиентов', 'др клиента', 'др клиент', 'birthday'],
  // Сотрудник спрашивает «как уволиться» — то же, что регламент/процесс увольнения
  ['программатик', 'программатика', 'программатики', 'programmatic'],
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
  return tokenizeForRag(question).filter((t) => t.length >= 4 && !GENERIC_QUERY_TOKENS.has(t));
}

/** Редкие якоря запроса: длинные слова и латиница (programmatic). */
export function rareDistinctiveTokens(distinctive: string[]): string[] {
  return distinctive.filter((t) => t.length >= 8 || /[a-z]/i.test(t));
}

export function hitCoversDistinctiveTokens(
  title: string,
  snippets: string[],
  distinctive: string[]
): boolean {
  if (!distinctive.length) return true;
  const blob = `${title}\n${snippets.join('\n')}`;
  const rare = rareDistinctiveTokens(distinctive);
  if (rare.length) {
    // Обязателен самый специфичный якорь (программатики), не «расчётов» из чужого блока
    const longest = [...rare].sort((a, b) => b.length - a.length || a.localeCompare(b))[0]!;
    return textCoversToken(blob, longest);
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
