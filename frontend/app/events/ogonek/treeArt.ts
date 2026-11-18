/**
 * Ёлка желаний: рисуется кодом на сетке 200×320 мелким пикселем и
 * растягивается целым множителем. Стиль — как у классической пиксельной
 * ёлки: ярусы с рваными лапами, у каждого светлый верх и тёмный низ,
 * золотая мишура наискосок, звезда и красная кадка. Шариков нет:
 * игрушки на ёлке только от людей.
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
    tiers: 8,
    half: ogonekTreeHalfWidth,
    baubles: 0,
    tinsel: 5,
    gifts: true,
    seed: 20271225
  });
  return cached;
}

/** Маленькая ёлка для плитки в календаре: та же рисовка. */
export function ogonekMiniTreeImage(): TreeArt {
  cachedMini ??= drawTree({
    w: 76,
    h: 96,
    top: 0.14,
    bottom: 0.84,
    tiers: 6,
    half: (y) => {
      const t = Math.min(1, Math.max(0, (y - 0.14) / 0.7));
      return 0.08 + 0.4 * Math.pow(t, 0.75);
    },
    baubles: 0,
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

  /** Масштаб деталей относительно сетки шириной 100. */
  const sc = W / 100;
  const u1 = Math.max(1, Math.round(sc));

  // 1. Ярусы из веток-прядей. Сначала тёмная основа яруса, поверх неё —
  //    десятки веток: каждая тянется от оси наружу и вниз и заканчивается
  //    кончиком. Ветка светлая сверху и тёмная снизу, правый бок темнее
  //    (свет слева сверху). Крайние ветки рисуются первыми, центральные —
  //    поверх: центр ёлки ближе к нам. Кончики к краям провисают сильнее.
  const span = (bottom - top) / T;
  const paintAt = (x: number, y: number, k: number, c: string) => {
    if (!inside(x, y)) return;
    tierOf[y * W + x] = k;
    px[y * W + x] = c;
  };
  const thick = Math.max(1, Math.round(sc));
  for (let k = T - 1; k >= 0; k--) {
    const ya = k === 0 ? top - span * 0.2 : top + span * k - span * 0.75;
    const yb = top + span * (k + 1);
    const hw = cfg.half(yb / H) * W;
    // Основа: тёмная, видна в щелях между ветками
    for (let y = Math.ceil(ya + span * 0.25); y <= yb; y++) {
      const v = (y - ya) / (yb - ya);
      const w = hw * 0.92 * Math.pow(v, 0.9);
      for (let x = Math.ceil(cx - w); x <= Math.floor(cx + w); x++) paintAt(x, y, k, '4');
    }
    const n = Math.round(hw * 1.5) + 8;
    const strands: { u: number; r: number }[] = [];
    for (let i = 0; i < n; i++) strands.push({ u: (i / (n - 1)) * 2 - 1 + (rand() - 0.5) * (2 / n), r: rand() });
    strands.sort((a, b) => Math.abs(b.u) - Math.abs(a.u));
    for (const { u, r } of strands) {
      const au = Math.abs(u);
      const sy = ya + (yb - ya) * (0.12 + r * 0.38);
      const sx = cx + u * hw * (0.08 + ((sy - ya) / (yb - ya)) * 0.45);
      const ex = cx + u * hw * (0.94 + rand() * 0.12);
      const ey = yb - (1 - au) * span * 0.12 + Math.pow(au, 1.6) * span * 0.32 + rand() * 2.5 * sc;
      const len = Math.hypot(ex - sx, ey - sy);
      const steps = Math.max(2, Math.ceil(len));
      for (let st = 0; st <= steps; st++) {
        const t = st / steps;
        // Ветка чуть выгнута вверх в середине — как настоящая лапа
        const bx = sx + (ex - sx) * t;
        const by = sy + (ey - sy) * t - Math.sin(Math.PI * t) * span * 0.08;
        const x = Math.round(bx);
        const y = Math.round(by);
        const w = t > 0.85 ? 1 : thick + 1;
        const lightSide = u < 0.3;
        for (let d = 0; d < w; d++) {
          let c: string;
          const upper = d === 0;
          if (t > 0.9) c = lightSide ? '6' : '5';
          else if (upper) c = au > 0.7 && !lightSide ? '5' : lightSide && t > 0.35 ? '6' : '5';
          else c = d === w - 1 ? '4' : lightSide ? '5' : '4';
          paintAt(x, y + d, k, c);
        }
      }
    }
  }

  // 2. Тень яруса на ярус ниже, затем снег на открытых сверху лапах
  const base = px.slice();
  const darker: Record<string, string> = { '6': '5', '5': '4', '4': 'a' };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = tierAt(x, y);
      if (k < 0 || base[y * W + x] === '.') continue;
      for (let d = 1; d <= thick * 3; d++) {
        const a = tierAt(x, y - d);
        if (a >= 0 && a < k) {
          set(x, y, darker[base[y * W + x]!] ?? base[y * W + x]!);
          break;
        }
      }
    }
  }
  const withShade = px.slice();
  for (let x = 0; x < W; x++) {
    for (let y = 1; y < H - 3; y++) {
      if (tierAt(x, y) < 0) continue;
      if (withShade[(y - 1) * W + x] !== '.') continue;
      // Снег ложится на толстые лапы, тонкие кончики — без снега
      const solid = tierAt(x, y + 1) >= 0 && tierAt(x, y + 2) >= 0 && tierAt(x, y + 3) >= 0;
      if (!solid || rand() < 0.12) continue;
      const depth = 1 + (rand() < 0.5 ? 1 : 0) + (sc > 1.5 ? 1 : 0);
      for (let d = 0; d < depth; d++) set(x, y + d, d === 0 ? 'f' : d === depth - 1 ? 'c' : 'e');
    }
  }

  // 3. Мишура: витой золотой шнур наискосок с провисом, поверх хвои.
  //    Свет и тень чередуются — шнур читается как скрученный.
  const glints: { x: number; y: number }[] = [];
  for (let i = 0; i < cfg.tinsel; i++) {
    const yA = top + (bottom - top) * ((i + 0.8) / (cfg.tinsel + 0.6));
    const tilt = (i % 2 ? -1 : 1) * span * 0.6;
    const hw = cfg.half(yA / H) * W * 1.05;
    const twist = Math.max(2, Math.round(3 * sc));
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      const y = Math.round(yA + tilt * (u - 0.5) + span * 0.35 * Math.sin(Math.PI * u));
      if (tierAt(x, y) < 0) continue;
      const ph = (x + i * 2) % twist;
      for (let t = 0; t < u1; t++) {
        if (tierAt(x, y + t) < 0) continue;
        set(x, y + t, ph === 0 ? '9' : t === u1 - 1 ? '7' : '8');
      }
      if (tierAt(x, y + u1) >= 0) set(x, y + u1, ph === 1 ? '7' : get(x, y + u1) === 'a' ? 'a' : '4');
      if (ph === 0 && rand() < 0.25) glints.push({ x, y });
    }
  }

  // 4. Шарики, если заданы (на ёлке желаний их нет: игрушки — только от людей)
  const bulbs: OgonekTreeBulb[] = [];
  const placed: [number, number][] = [];
  const big = W >= 80;
  for (const g of glints) {
    bulbs.push({ x: g.x / W, y: g.y / H, color: OGONEK_PALETTE['9']!, delay: -((g.x * 0.37 + g.y * 0.11) % 5) });
  }
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
  const sf = u1;
  const starX = Math.round(cx - 4.5 * sf + 0.5);
  const starY = top - 7 * sf;
  STAR.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    for (let dy = 0; dy < sf; dy++) for (let dx = 0; dx < sf; dx++) set(starX + x * sf + dx, starY + y * sf + dy, c);
  }));

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
          if (Math.abs(x - Math.floor(gw / 2)) < u1 || (y >= 2 * u1 && y < 3 * u1)) c = ribbon;
          set(gx + x, gy + y, c);
        }
      }
      set(gx + Math.floor(gw / 2) - 1, gy - 1, ribbon);
      set(gx + Math.floor(gw / 2) + 1, gy - 1, ribbon);
    };
    gift(Math.round(cx - W * 0.26), 9 * u1, 7 * u1, 'b', 'a', '9');
    gift(Math.round(cx + W * 0.14), 8 * u1, 6 * u1, 'h', 'g', '2');
    gift(Math.round(cx - W * 0.17), 6 * u1, 5 * u1, '9', '7', '2');
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
