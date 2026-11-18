/**
 * Ёлка желаний в крупный пиксель: рисуется кодом на маленькой сетке и
 * растягивается целым множителем. Стиль — как у классической пиксельной
 * ёлки: ярусы с рваными лапами, у каждого светлый верх и тёмный низ,
 * золотая мишура наискосок, россыпь шариков, звезда и красная кадка.
 *
 * Свет слева сверху. Часть шариков светится: их координаты отдаются
 * отдельно, свечение рисуется элементами поверх картинки.
 */
import { OGONEK_PALETTE } from './palette';
import {
  OGONEK_TREE_BOTTOM,
  OGONEK_TREE_H,
  OGONEK_TREE_TOP,
  OGONEK_TREE_W,
  ogonekTreeHalfWidth
} from './treePlacement';

export type OgonekTreeBulb = { x: number; y: number; color: string; delay: number };
type TreeArt = { url: string; bulbs: OgonekTreeBulb[]; w: number; h: number };

type TreeCfg = {
  w: number;
  h: number;
  top: number;
  bottom: number;
  tiers: number;
  /** Полуширина кроны в долях ширины для высоты y (доля высоты). */
  half: (y: number) => number;
  /** Сколько шариков нарисовать прямо на хвое. */
  baubles: number;
  tinsel: number;
  gifts: boolean;
  seed: number;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

let cached: TreeArt | null = null;
let cachedMini: TreeArt | null = null;

/** Большая ёлка желаний: на неё вешают игрушки, её прокручивают вниз. */
export function ogonekTreeImage(): TreeArt {
  cached ??= drawTree({
    w: OGONEK_TREE_W,
    h: OGONEK_TREE_H,
    top: OGONEK_TREE_TOP,
    bottom: OGONEK_TREE_BOTTOM,
    tiers: 10,
    half: ogonekTreeHalfWidth,
    baubles: 46,
    tinsel: 4,
    gifts: true,
    seed: 20271225
  });
  return cached;
}

/** Маленькая ёлка для плитки в календаре: та же рисовка. */
export function ogonekMiniTreeImage(): TreeArt {
  cachedMini ??= drawTree({
    w: 44,
    h: 56,
    top: 0.14,
    bottom: 0.84,
    tiers: 6,
    half: (y) => {
      const t = Math.min(1, Math.max(0, (y - 0.14) / 0.7));
      return 0.08 + 0.4 * Math.pow(t, 0.75);
    },
    baubles: 16,
    tinsel: 2,
    gifts: false,
    seed: 1225
  });
  return cachedMini;
}

const BAUBLE_COLORS = ['2', '3', '8', '9', 'h', 'b', 'c', 'g'];
const GLOW_COLORS = new Set(['3', '9', 'c', 'h']);

/** Звезда 9×9: светлое золото сверху слева, охра снизу справа. */
const STAR = [
  '....9....',
  '...999...',
  '...989...',
  '999888877',
  '.9988887.',
  '..98887..',
  '..88.87..',
  '.887.877.',
  '.77...77.'
];

function drawTree(cfg: TreeCfg): TreeArt {
  const W = cfg.w;
  const H = cfg.h;
  const T = cfg.tiers;
  const rand = rng(cfg.seed);
  const top = Math.round(cfg.top * H);
  const bottom = Math.round(cfg.bottom * H);
  const cx = (W - 1) / 2;

  const px: string[] = Array<string>(W * H).fill('.');
  const tierOf = new Int16Array(W * H).fill(-1);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x: number, y: number) => (inside(x, y) ? px[y * W + x]! : '.');
  const set = (x: number, y: number, c: string) => { if (inside(x, y)) px[y * W + x] = c; };
  const tierAt = (x: number, y: number) => (inside(x, y) ? tierOf[y * W + x]! : -1);

  // 1. Силуэт: ярусы снизу вверх, верхний ложится поверх нижнего.
  //    Низ яруса — рваные лапы: ступеньки по 2–4 пикселя разной глубины.
  const span = (bottom - top) / T;
  for (let k = T - 1; k >= 0; k--) {
    const y1 = Math.round(top + span * (k + 1));
    const y0 = Math.round(top + span * k - (k ? span * 0.55 : 0));
    const hwB = cfg.half(y1 / H) * W;
    const hwT = k === 0 ? 0.6 : hwB * 0.5;
    // Лапы — ровная пила: кончик каждые 6 пикселей, сдвиг свой у яруса
    const ZIG = [0, 1, 2, 2, 1, 0];
    const phase = Math.floor(rand() * 6);
    const dips = Array.from({ length: W }, (_, x) => ZIG[(x + phase) % 6]!);
    for (let y = y0; y <= y1 + 2; y++) {
      const v = Math.min(1, (y - y0) / Math.max(1, y1 - y0));
      const hw = hwT + (hwB - hwT) * Math.pow(v, 0.85);
      for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
        if (y > y1 && dips[x]! < y - y1) continue;
        // Кончики крайних лап торчат в стороны и чуть вниз
        if (!inside(x, y)) continue;
        tierOf[y * W + x] = k;
        px[y * W + x] = '5';
      }
    }
  }

  // 2. Тени и свет по ярусам
  const base = px.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = tierAt(x, y);
      if (k < 0 || base[y * W + x] === '.') continue;
      const below = tierAt(x, y + 1);
      const above1 = tierAt(x, y - 1);
      const above2 = tierAt(x, y - 2);
      const edgeSide = tierAt(x - 1, y) < 0 || tierAt(x + 1, y) < 0;
      let c = '5';
      if (below < 0 || below > k) c = 'a';
      else if (tierAt(x, y + 2) < 0 || tierAt(x, y + 2) > k) c = '4';
      else if (above1 >= 0 && above1 < k) c = '4';
      else if (above2 >= 0 && above2 < k) c = x < cx + 2 ? '6' : '5';
      else if (above1 < 0 || tierAt(x, y - 3) < 0) c = x < cx ? '6' : '5';
      if (edgeSide) c = 'a';
      // Правый бок чуть темнее: свет слева
      const hwHere = cfg.half(y / H) * W;
      // Редкие иголки: светлые слева, тёмные справа — без регулярной сетки
      if (c === '5' && x > cx + hwHere * 0.6 && rand() < 0.12) c = '4';
      if (c === '5' && x < cx - hwHere * 0.3 && rand() < 0.08) c = '6';
      set(x, y, c);
    }
  }

  // 3. Мишура: золотые нити наискосок с провисом, поверх хвои
  for (let i = 0; i < cfg.tinsel; i++) {
    const yA = top + (bottom - top) * ((i + 0.8) / (cfg.tinsel + 0.6));
    const tilt = (i % 2 ? -1 : 1) * span * 0.6;
    const hw = cfg.half(yA / H) * W * 1.05;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      const y = Math.round(yA + tilt * (u - 0.5) + span * 0.35 * Math.sin(Math.PI * u));
      if (tierAt(x, y) < 0) continue;
      set(x, y, (x + i) % 4 === 0 ? '9' : '8');
      if (tierAt(x, y + 1) >= 0 && get(x, y + 1) !== '8') set(x, y + 1, '7');
    }
  }

  // 4. Шарики: на хвое, не на мишуре и не вплотную друг к другу
  const bulbs: OgonekTreeBulb[] = [];
  const placed: [number, number][] = [];
  const big = W >= 80;
  for (let tries = 0; placed.length < cfg.baubles && tries < cfg.baubles * 60; tries++) {
    const y = Math.round(top + 3 + rand() * (bottom - top - 2));
    const hw = cfg.half(y / H) * W * 0.85;
    const x = Math.round(cx + (rand() * 2 - 1) * hw);
    const size = big && rand() < 0.45 ? 3 : 2;
    let ok = true;
    for (let dy = -1; dy <= size && ok; dy++) {
      for (let dx = -1; dx <= size && ok; dx++) {
        const c = get(x + dx, y + dy);
        if (c === '.' || c === '8' || c === '7' || c === '9') ok = false;
      }
    }
    if (!ok) continue;
    if (placed.some(([px2, py2]) => Math.abs(px2 - x) + Math.abs(py2 - y) < (big ? 7 : 5))) continue;
    placed.push([x, y]);
    const color = BAUBLE_COLORS[Math.floor(rand() * BAUBLE_COLORS.length)]!;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) set(x + dx, y + dy, color);
    if (size === 3) {
      set(x, y, 'f');
      set(x + 1, y - 1, '7');
    } else {
      set(x, y, color === 'f' ? 'e' : 'f');
    }
    if (GLOW_COLORS.has(color)) {
      bulbs.push({
        x: (x + size / 2) / W,
        y: (y + size / 2) / H,
        color: OGONEK_PALETTE[color]!,
        delay: -((placed.length * 0.73) % 5)
      });
    }
  }

  // 5. Звезда на макушке
  const starX = Math.round(cx - 4);
  const starY = top - 7;
  STAR.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') set(starX + x, starY + y, c); }));

  // 6. Ствол и красная кадка
  const tw = Math.max(1, Math.round(W * 0.035));
  const trunkH = Math.max(2, Math.round(H * 0.025));
  let ty = bottom + 1;
  while (ty < H && tierAt(Math.round(cx), ty) >= 0) ty++;
  for (let y = ty; y < ty + trunkH; y++) {
    for (let x = Math.round(cx - tw); x <= Math.round(cx + tw); x++) set(x, y, x < cx ? '7' : '1');
  }
  const potTop = ty + trunkH;
  const potH = Math.max(4, Math.round(H * 0.07));
  for (let y = potTop; y < Math.min(H, potTop + potH); y++) {
    const v = (y - potTop) / potH;
    const half = Math.round(W * (0.11 - v * 0.03));
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      let c = x < cx - half * 0.4 ? '3' : x > cx + half * 0.5 ? '1' : '2';
      if (y === potTop) c = '3';
      if (y === potTop + 1 && x > cx + half * 0.5) c = '2';
      set(x, y, c);
    }
  }

  // 7. Подарки под ёлкой
  if (cfg.gifts) {
    const gift = (gx: number, gw: number, gh: number, box: string, shade: string, ribbon: string) => {
      const gy = potTop + potH - gh;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          let c = x === gw - 1 || y === gh - 1 ? shade : box;
          if (x === Math.floor(gw / 2) || y === 2) c = ribbon;
          set(gx + x, gy + y, c);
        }
      }
      set(gx + Math.floor(gw / 2) - 1, gy - 1, ribbon);
      set(gx + Math.floor(gw / 2) + 1, gy - 1, ribbon);
    };
    gift(Math.round(cx - W * 0.26), 9, 7, 'b', 'a', '9');
    gift(Math.round(cx + W * 0.14), 8, 6, 'h', 'g', '2');
    gift(Math.round(cx - W * 0.17), 6, 5, '9', '7', '2');
  }

  // Рендер сетки в картинку один к одному
  const img = new Uint8ClampedArray(W * H * 4);
  px.forEach((c, i) => {
    if (c === '.') return;
    const h = OGONEK_PALETTE[c]!;
    img[i * 4] = parseInt(h.slice(1, 3), 16);
    img[i * 4 + 1] = parseInt(h.slice(3, 5), 16);
    img[i * 4 + 2] = parseInt(h.slice(5, 7), 16);
    img[i * 4 + 3] = 255;
  });
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.putImageData(new ImageData(img, W, H), 0, 0);
  return { url: canvas.toDataURL('image/png'), bulbs, w: W, h: H };
}
