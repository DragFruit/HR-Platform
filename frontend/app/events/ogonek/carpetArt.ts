/**
 * Ковёр под календарём: бесшовный бордюр из ромбов, углы с медальоном и
 * поле. Сетки палитры, как весь остальной арт.
 *
 * Поле нарочно тихое — тёмная сетка на тёмном бордо: на нём лежат листки,
 * и узор не должен спорить с текстом на них.
 */

const BAND = 28;
/** Шаг ромбов: бордюр повторяется без стыков только кратно ему. */
const STEP = 14;

const blank = (w: number, h: number, c = '.') => Array.from({ length: h }, () => Array<string>(w).fill(c));
const join = (g: string[][]) => g.map((r) => r.join(''));

function diamond(g: string[][], cx: number, cy: number, r: number, fill: string, outline?: string) {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0]!.length; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d < r) g[y]![x] = fill;
      else if (d === r && outline) g[y]![x] = outline;
    }
  }
}

/** Полосы-нитки по краям бордюра: контур, хвоя, тень. */
function edgeStripes(g: string[][], len: number, at: (i: number, row: number) => void) {
  for (let i = 0; i < len; i++) {
    at(i, 0);
    at(i, 1);
    at(i, 2);
    at(i, BAND - 3);
    at(i, BAND - 2);
    at(i, BAND - 1);
  }
  void g;
}

const STRIPE: Record<number, string> = { 0: '0', 1: '7', 2: '1' };
const stripeKey = (row: number) => STRIPE[row < 3 ? row : BAND - 1 - row]!;

/** Бордюр по горизонтали: тайл 14×28, ромб охры с кремовой серединой. */
export const CARPET_BAND_H = (() => {
  // Тон-в-тон: ромбы чуть светлее фона, золото только тонкой ниткой
  const g = blank(STEP, BAND, '1');
  edgeStripes(g, STEP, (x, row) => { g[row]![x] = stripeKey(row); });
  diamond(g, 7, 13.5, 7, '1', '2');
  diamond(g, 7, 13.5, 3, '2');
  diamond(g, 7, 13.5, 1, '7');
  return join(g);
})();

/** Тот же бордюр, повёрнутый вертикально. */
export const CARPET_BAND_V = (() => {
  const h = CARPET_BAND_H;
  return Array.from({ length: h[0]!.length }, (_, x) => h.map((row) => row[x]).join(''));
})();

/** Угол 28×28: продолжает обе полосы и держит медальон. */
export const CARPET_CORNER = (() => {
  const g = blank(BAND, BAND, '1');
  for (let i = 0; i < BAND; i++) {
    for (const row of [0, 1, 2]) {
      g[row]![i] = stripeKey(row);
      g[i]![row] = stripeKey(row);
    }
    for (const row of [BAND - 3, BAND - 2, BAND - 1]) {
      if (i >= BAND - 3) {
        g[row]![i] = stripeKey(row);
        g[i]![row] = stripeKey(row);
      }
    }
  }
  diamond(g, 14, 14, 10, '1', '7');
  diamond(g, 14, 14, 7, '2', '0');
  diamond(g, 14, 14, 4, '1', '2');
  diamond(g, 14, 14, 1.5, '7');
  return join(g);
})();

export const flipX = (rows: readonly string[]) => rows.map((r) => [...r].reverse().join(''));
export const flipY = (rows: readonly string[]) => [...rows].reverse();

/** Поле: тихая ромбовая сетка тенью бордо по тёмному фону. */
export const CARPET_FIELD = (() => {
  const n = 24;
  const g = blank(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if ((x + y) % n === 0 || (x - y + n) % n === 0) g[y]![x] = '1';
    }
  }
  // Узелок на пересечении нитей
  g[12]![12] = '7';
  return join(g);
})();
