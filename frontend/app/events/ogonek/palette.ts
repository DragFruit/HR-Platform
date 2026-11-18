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
 * Значения сдвинуты на полтона теплее и ярче исходной таблицы спеки: на
 * ярком красном фоне интерфейса (прототип) приглушённые тона выглядели
 * пыльными и тонули. Состав семейств и правило трёх тонов прежние.
 *
 * Символ в строке спрайта — ключ из этой таблицы, `.` — прозрачность.
 * Ключи однобуквенные, чтобы строка спрайта оставалась сеткой пикселей,
 * где один символ равен одному пикселю.
 */

export type OgonekFamilyId = 'bordo' | 'fir' | 'ochre' | 'teal' | 'cream' | 'peach';

export type OgonekTone = 'shadow' | 'base' | 'light';

/** Контур общий для всех семейств. */
export const OGONEK_OUTLINE = '#1e0c0e';
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
  '1': '#6a1420', '2': '#b0232f', '3': '#e0464f',   // бордо
  '4': '#16432d', '5': '#22804a', '6': '#45bd68',   // хвоя
  '7': '#bf7714', '8': '#f5ad2c', '9': '#ffd35c',   // охра
  a: '#1c6a73', b: '#2fa7a8', c: '#7ad8cf',         // бирюза
  d: '#d8c39b', e: '#f4e6c8', f: '#fffaf0',         // кремовый
  g: '#d8814f', h: '#f8b386'                        // персик
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
