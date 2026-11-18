/**
 * Арт коробки с письмами: конверт по слоям и бумага письма.
 *
 * Конверт — обычные сетки палитры, но разобранные на слои, чтобы клапан мог
 * открываться, а лист выезжать из кармана. Коробка — тот же спрайт подарка
 * из окна 18, разрезанный на крышку и низ.
 *
 * Бумага рисуется на canvas: у каждого письма свой лист по его id, с волокном,
 * рыжими пятнышками, сгибами и неровным краем.
 */
import { OGONEK_OBJECTS } from './sprites';

const W = 64;
const H = 40;
const FLAP_H = 24;

const blank = (w: number, h: number) => Array.from({ length: h }, () => Array<string>(w).fill('.'));
const join = (g: string[][]) => g.map((r) => r.join(''));

/** Высота линии клапана над колонкой x: от углов к центру. */
const veeY = (x: number) => Math.round(((Math.min(x, W - 1 - x)) / (W / 2 - 1)) * (FLAP_H - 2));

/** Задняя стенка: тень внутри конверта. */
export const ENVELOPE_BACK = (() => {
  const g = blank(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      g[y]![x] = edge ? '0' : y < 6 ? '7' : 'd';
    }
  }
  return join(g);
})();

/** Карман: передняя стенка с вырезом под клапан. */
export const ENVELOPE_FRONT = (() => {
  const g = blank(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = veeY(x);
      if (y < v) continue;
      const edge = x === 0 || x === W - 1 || y === H - 1 || y === v;
      if (edge) { g[y]![x] = '0'; continue; }
      // Боковые клинья чуть темнее нижнего: так читается склейка
      const bottomFold = H - 1 - y > Math.min(x, W - 1 - x) * 0.72;
      let c = bottomFold ? 'e' : 'd';
      if (y === H - 2 || x === W - 2) c = 'd';
      if (x === 1) c = 'f';
      if (!bottomFold && (x + y) % 11 === 0) c = 'e';
      g[y]![x] = c;
    }
  }
  return join(g);
})();

/** Клапан: острым углом вниз, со светом слева сверху. */
export const ENVELOPE_FLAP = (() => {
  const g = blank(W, FLAP_H);
  for (let x = 0; x < W; x++) {
    const v = veeY(x);
    for (let y = 0; y <= v; y++) {
      const edge = y === v || y === 0 || x === 0 || x === W - 1;
      let c = edge ? '0' : 'e';
      if (!edge && y < 2) c = 'f';
      if (!edge && y === v - 1) c = 'd';
      if (!edge && x < W / 2 && y === v - 2) c = 'f';
      g[y]![x] = c;
    }
  }
  return join(g);
})();

/** Сургучная печать 14×14. */
export const ENVELOPE_SEAL = (() => {
  const n = 14;
  const g = blank(n, n);
  const c = (n - 1) / 2;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      // Край неровный: сургуч растёкся
      if (d > 6.9 - ((x * 7 + y * 13) % 3) * 0.3) continue;
      if (d > 5.6) g[y]![x] = '0';
      else if (x + y < c * 2 - 4) g[y]![x] = '3';
      else if (x + y > c * 2 + 4) g[y]![x] = '1';
      else g[y]![x] = '2';
    }
  }
  // Оттиск: маленький огонёк
  for (const [x, y] of [[6, 4], [7, 4], [5, 5], [8, 5], [5, 6], [8, 6], [6, 7], [7, 7], [6, 8], [7, 8]] as const) {
    g[y]![x] = '1';
  }
  return join(g);
})();

const GIFT_CUT = 15;
export const BOX_LID = OGONEK_OBJECTS.gift.slice(0, GIFT_CUT);
export const BOX_BODY = OGONEK_OBJECTS.gift.slice(GIFT_CUT);

function hashSeed(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const paperCache = new Map<string, string>();

/** Лист письма: свой для каждого письма и одинаковый при каждом открытии. */
export function ogonekPaperUrl(id: string): string {
  const hit = paperCache.get(id);
  if (hit) return hit;
  const w = 150;
  const h = 200;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const rand = rng(hashSeed(id));

  // Неровный край: у каждой строки и колонки свой отступ
  const edge = (n: number) => {
    const out: number[] = [];
    let v = 1;
    for (let i = 0; i < n; i++) {
      if (rand() < 0.22) v = Math.max(0, Math.min(3, v + (rand() < 0.5 ? -1 : 1)));
      out.push(v);
    }
    return out;
  };
  const left = edge(h);
  const right = edge(h);
  const top = edge(w);
  const bottom = edge(w);

  // Рыжие пятнышки времени
  const spots = Array.from({ length: 7 + Math.floor(rand() * 7) }, () => ({
    x: rand() * w,
    y: rand() * h,
    r: 2 + rand() * 7
  }));
  const creases = [Math.round(h / 3), Math.round((h * 2) / 3)];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < left[y]! || x >= w - right[y]! || y < top[x]! || y >= h - bottom[x]!) continue;
      const toEdge = Math.min(x - left[y]!, w - 1 - right[y]! - x, y - top[x]!, h - 1 - bottom[x]! - y);
      // Волокно идёт полосами вдоль листа
      const fibre = Math.sin(y * 0.9 + Math.sin(x * 0.07) * 3) + rand() * 1.6;
      let color = '#e8d7b4';
      if (fibre > 1.75) color = '#efe2c5';
      else if (fibre < -0.45) color = '#ddc9a2';
      if (rand() < 0.012) color = '#c7b48d';
      // Края темнее: лист полежал
      if (toEdge < 2) color = '#c7b48d';
      else if (toEdge < 5 && rand() < 0.5) color = '#d6c29b';
      for (const s of spots) {
        const d = Math.hypot(x - s.x, y - s.y);
        if (d < s.r && rand() < 0.5 * (1 - d / s.r)) color = '#c9a877';
      }
      // Сгибы: тёмная линия и сразу под ней светлая
      if (creases.includes(y)) color = '#d6c29b';
      if (creases.includes(y - 1)) color = '#efe2c5';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const url = canvas.toDataURL('image/png');
  paperCache.set(id, url);
  return url;
}
