/**
 * Стеммер по мотивам Snowball Russian — общий для обычного поиска /knowledge (клиент)
 * и словесного слоя RAG (server/utils/knowledgeRagLexical.ts).
 * Вынесен 2026-10-20 без изменения поведения.
 */

const RU_VOWELS = 'аеиоуыэюя';

const byLonger = (a: string, b: string) => b.length - a.length;

/**
 * Кэш горячего пути (2026-10-19: фолбэк RAG считал стеммер для каждого слова каждой статьи заново —
 * ~40 с синхронного CPU). Результат чистый — кэшируем; при переполнении просто сбрасываем.
 */
const STEM_CACHE_MAX = 50_000;
const stemCache = new Map<string, string>();

export function stemRu(raw: string): string {
  const key = String(raw || '');
  const cached = stemCache.get(key);
  if (cached !== undefined) return cached;
  const out = stemRuUncached(key);
  if (stemCache.size >= STEM_CACHE_MAX) stemCache.clear();
  stemCache.set(key, out);
  return out;
}

function stemRuUncached(raw: string): string {
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
