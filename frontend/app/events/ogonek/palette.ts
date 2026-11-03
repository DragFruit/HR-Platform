/**
 * Палитра «Огонька 2027»: шесть семейств по 2-3 тона плюс общий контур
 * (docs/quests/ogonek-2027.md, раздел 2).
 *
 * Первая версия спеки задавала восемь плоских цветов. Так можно нарисовать
 * орнамент ковра — он и должен быть плоским, — но нельзя нарисовать предмет
 * с объёмом: получается аппликация. Поэтому у каждого цвета есть тень и свет.
 *
 * Правило, которому подчиняются все спрайты: предмет рисуется минимум в трёх
 * тонах одного семейства плюс контур. База, тень со стороны, противоположной
 * свету, и один блик. **Свет падает слева сверху, одинаково везде.**
 *
 * Символ в строке спрайта — ключ из этой таблицы, `.` — прозрачность.
 * Ключи однобуквенные, чтобы строка спрайта оставалась сеткой пикселей,
 * где один символ равен одному пикселю.
 */

export type OgonekFamilyId = 'bordo' | 'fir' | 'ochre' | 'teal' | 'cream' | 'peach';

export type OgonekTone = 'shadow' | 'base' | 'light';

/** Контур общий для всех семейств. */
export const OGONEK_OUTLINE = '#1a1412';
export const OGONEK_OUTLINE_KEY = '0';

type Family = {
  id: OgonekFamilyId;
  title: string;
  /** Ключи тонов в порядке тень → база → свет. У персика света нет. */
  keys: { shadow: string; base: string; light?: string };
};

export const OGONEK_FAMILIES: Family[] = [
  { id: 'bordo', title: 'Бордо', keys: { shadow: '1', base: '2', light: '3' } },
  { id: 'fir', title: 'Хвоя', keys: { shadow: '4', base: '5', light: '6' } },
  { id: 'ochre', title: 'Охра', keys: { shadow: '7', base: '8', light: '9' } },
  { id: 'teal', title: 'Бирюза', keys: { shadow: 'a', base: 'b', light: 'c' } },
  { id: 'cream', title: 'Кремовый', keys: { shadow: 'd', base: 'e', light: 'f' } },
  { id: 'peach', title: 'Персик', keys: { shadow: 'g', base: 'h' } }
];

/** Ключ символа → цвет. Единственное место, где живут сами значения. */
export const OGONEK_PALETTE: Record<string, string> = {
  '0': OGONEK_OUTLINE,
  '1': '#4e1018', '2': '#7d1f28', '3': '#a93b42',   // бордо
  '4': '#12291f', '5': '#1f4136', '6': '#356b55',   // хвоя
  '7': '#9c6516', '8': '#d99a2b', '9': '#f0c25e',   // охра
  a: '#1b544f', b: '#2f7f7a', c: '#4fada6',         // бирюза
  d: '#c7b48d', e: '#e8d7b4', f: '#f5efe3',         // кремовый
  g: '#c47a52', h: '#e8a87c'                        // персик
};

/** Все допустимые символы сетки, включая прозрачность. Для валидации. */
export const OGONEK_PIXEL_CHARS = `.${Object.keys(OGONEK_PALETTE).join('')}`;

/** Регулярка для проверки строки сетки: только символы палитры и точка. */
export const OGONEK_PIXEL_RE = /^[.0-9a-h]+$/;

/** Цвет по символу строки спрайта. `null` — прозрачный пиксель. */
export function ogonekColorAt(ch: string): string | null {
  if (!ch || ch === '.' || ch === ' ') return null;
  return OGONEK_PALETTE[ch] ?? null;
}

/** Подпись тона для редактора игрушки. */
export function ogonekToneTitle(family: Family, tone: OgonekTone): string {
  const suffix = tone === 'shadow' ? 'тень' : tone === 'light' ? 'свет' : 'база';
  return `${family.title}, ${suffix}`;
}
