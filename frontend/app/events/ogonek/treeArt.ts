/**
 * Ёлка желаний: рисуется кодом на сетке 200×320 мелким пикселем и
 * растягивается целым множителем. Стиль — как у классической пиксельной
 * ёлки: ярусы с рваными лапами, у каждого светлый верх и тёмный низ,
 * ретро-убранство: баранки на бечёвке с лентами, бумажные флажки,
 * золотые банты, шишки. Шариков нет: игрушки на ёлке только от людей.
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
    tinsel: 6,
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

/**
 * Тёплые цвета ретро-ёлки поверх общей палитры: глубокая оливковая хвоя,
 * баранки, ленты, бумага флажков. Ключи — буквы после h, чтобы не пересечься.
 */
const TREE_PAL: Record<string, string> = {
  ...OGONEK_PALETTE,
  n: '#0f2617', // глубина хвои
  m: '#1a4126', // нижняя сторона ветки
  l: '#2b5c32', // верх ветки
  k: '#5b8640', // кончики на свету
  r: '#b3262a', // лента красная
  o: '#7a4a22', // лента коричневая, шишка
  w: '#4d6e3f', // лента зелёная
  s: '#c98a3f', // баранка
  t: '#ebbd72', // баранка, блик
  u: '#8e5a26', // баранка, тень
  v: '#efe2c4', // бумага флажка
  x: '#4f7e77', // флажок бирюзовый, выцветший
  y: '#cf9c3c', // флажок охра
  z: '#8f9b6c'  // флажок шалфей
};

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
      for (let x = Math.ceil(cx - w); x <= Math.floor(cx + w); x++) paintAt(x, y, k, 'n');
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
          if (t > 0.9) c = lightSide ? 'k' : 'l';
          else if (upper) c = au > 0.7 && !lightSide ? 'm' : lightSide && t > 0.45 ? 'k' : 'l';
          else c = d === w - 1 ? 'n' : lightSide ? 'l' : 'm';
          paintAt(x, y + d, k, c);
        }
      }
    }
  }

  // 2. Тень яруса на ярус ниже
  const base = px.slice();
  const darker: Record<string, string> = { k: 'l', l: 'm', m: 'n', n: '0' };
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
  // 3. Ретро-убранство: гирлянды из баранок с лентами и бумажные флажки
  //    чередуются провисающими дугами, сверху — золотые банты, по хвое шишки.
  const isNeedle = (x: number, y: number) => 'nmlk0'.includes(get(x, y)) && tierAt(x, y) >= 0;
  const glints: { x: number; y: number }[] = [];

  // Шишки: первыми, гирлянды лягут поверх
  const cones = Math.round(4 + 8 * Math.min(1, sc));
  for (let i = 0, tries = 0; i < cones && tries < 400; tries++) {
    const y = Math.round(top + span * 0.6 + rand() * (bottom - top - span));
    const x = Math.round(cx + (rand() * 2 - 1) * cfg.half(y / H) * W * 0.8);
    if (!isNeedle(x, y) || !isNeedle(x, y + 4 * u1)) continue;
    i++;
    const cw = Math.max(2, Math.round(1.6 * sc));
    const ch = Math.max(3, Math.round(2.6 * sc));
    for (let dy = 0; dy < ch; dy++) {
      const half = Math.max(0.5, cw * (1 - Math.abs(dy / ch - 0.45) * 1.1));
      for (let dx = Math.floor(-half); dx <= Math.ceil(half) - 1; dx++) {
        set(x + dx, y + dy, (dx + dy) % 2 === 0 ? 'o' : dy < ch / 2 ? 'u' : '1');
      }
    }
    set(x, y - 1, '0');
  }

  const swag = (i: number) => {
    // Нижняя дуга заканчивается над кадкой, не на ней
    const yA = top + (bottom - top - span * 0.9) * ((i + 0.75) / (cfg.tinsel + 0.1));
    const tilt = (i % 2 ? -1 : 1) * span * 0.45;
    const hw = cfg.half(yA / H) * W * 0.97;
    return { hw, at: (x: number) => {
      const u = (x - (cx - hw)) / (2 * hw);
      return yA + tilt * (u - 0.5) + span * 0.55 * Math.sin(Math.PI * u);
    } };
  };

  const ribbon = (x0: number, y0: number, len: number, col: string, phase: number) => {
    for (let t = 0; t < len; t++) {
      const x = Math.round(x0 + Math.sin(t / (3 * sc + 1) + phase) * sc * 0.7);
      for (let d = 0; d < u1; d++) set(x + d, y0 + t, d === 0 ? col : col === 'r' ? '1' : col === 'w' ? 'm' : 'u');
    }
    // Срез ленты «ласточкин хвост»
    set(Math.round(x0), y0 + len, col);
  };

  for (let i = 0; i < cfg.tinsel; i++) {
    const { hw, at } = swag(i);
    const x0 = Math.ceil(cx - hw);
    const x1 = Math.floor(cx + hw);
    if (i % 2 === 0) {
      // Баранки на бечёвке; у каждой третьей — бантик и пучок лент
      const D = Math.max(4, Math.round(4.4 * sc));
      const R = D / 2;
      const ringW = Math.max(1, sc * 1.1);
      for (let x = x0; x <= x1; x++) set(x, Math.round(at(x)), '7');
      let n = 0;
      for (let bx = x0 + 1; bx <= x1 - D; bx += D + Math.max(1, Math.round(sc * 0.6)), n++) {
        const by = Math.round(at(bx + R)) - Math.floor(R);
        for (let dy = 0; dy < D; dy++) {
          for (let dx = 0; dx < D; dx++) {
            const r = Math.hypot(dx + 0.5 - R, dy + 0.5 - R);
            if (r > R || r < R - ringW - 0.4) continue;
            const lit = dx + dy < D - 1;
            const rim = r > R - 0.9;
            set(bx + dx, by + dy, rim && !lit ? 'u' : lit && r > R - ringW * 0.6 ? 't' : rim ? 's' : lit ? 's' : 'u');
          }
        }
        if (n % 3 === 1) {
          const kx = bx + Math.floor(R);
          const ky = by + D;
          set(kx - 1, ky, 'r'); set(kx, ky, '1'); set(kx + 1, ky, 'r');
          const cols = ['r', 'o', 'w', 'r'];
          for (let q = 0; q < 3; q++) {
            ribbon(kx - 1 + q, ky + 1, Math.round(span * (0.45 + rand() * 0.45)), cols[(n + q) % cols.length]!, rand() * 6);
          }
        }
      }
    } else {
      // Бумажные флажки на нитке: ретро-открытки с каймой и рисунком
      for (let x = x0; x <= x1; x++) set(x, Math.round(at(x)), 'd');
      const fw = Math.max(3, Math.round(4.6 * sc));
      const fh = Math.max(4, Math.round(6 * sc));
      const gap = Math.max(1, Math.round(1.6 * sc));
      const fills = ['r', 'x', 'y', 'z', 'r', 'v'];
      let n = 0;
      for (let fx = x0 + 2; fx <= x1 - fw - 1; fx += fw + gap, n++) {
        const fy = Math.round(at(fx + fw / 2)) + 1;
        const fill = fills[(n * 7 + i) % fills.length]!;
        const notch = Math.max(1, Math.round(fh * 0.3));
        for (let dy = 0; dy < fh; dy++) {
          for (let dx = 0; dx < fw; dx++) {
            // Низ — ласточкин хвост
            const fromMid = Math.abs(dx - (fw - 1) / 2);
            if (dy >= fh - notch && fromMid < (dy - (fh - notch) + 1) * ((fw / 2) / notch)) continue;
            const edge = dx === 0 || dx === fw - 1 || dy === 0;
            set(fx + dx, fy + dy, edge && fill !== 'v' ? 'v' : edge ? 'd' : fill);
          }
        }
        // Рисунок на открытке: фигурка-силуэт 2–3 пикселя
        const mx = fx + Math.floor(fw / 2);
        const my = fy + Math.floor(fh * 0.38);
        const ink = fill === 'v' || fill === 'y' ? '1' : 'v';
        set(mx, my, ink); set(mx - 1, my + 1, ink); set(mx, my + 1, ink); set(mx + 1, my + 1, ink);
        if (sc > 1.5) { set(mx, my - 1, ink); set(mx - 1, my + 2, ink); set(mx + 1, my + 2, ink); }
        // Тень флажка на хвою
        for (let dy = 1; dy < fh - notch; dy++) if (isNeedle(fx + fw, fy + dy)) set(fx + fw, fy + dy, 'n');
      }
    }
  }

  // Золотые банты между гирляндами
  const bows = Math.max(1, Math.round(cfg.tinsel * 0.6));
  for (let i = 0; i < bows; i++) {
    const { at } = swag(Math.min(cfg.tinsel - 1, i * 2 + 1));
    const bx = Math.round(cx + (i % 2 ? 1 : -1) * cfg.half(0.5) * W * (0.25 + 0.2 * rand()));
    const by = Math.round(at(bx) + span * 0.55);
    const bw = Math.max(3, Math.round(3.4 * sc));
    const bh = Math.max(2, Math.round(2.4 * sc));
    for (const side of [-1, 1]) {
      for (let dx = 1; dx <= bw; dx++) {
        const h = Math.round(bh * (dx / bw));
        for (let dy = -h; dy <= h; dy++) set(bx + side * dx, by + dy, Math.abs(dy) === h ? '7' : dy < 0 ? '9' : '8');
      }
    }
    set(bx, by, '7'); set(bx, by - 1, '8'); set(bx, by + 1, '7');
    // Хвосты банта
    for (let t = 1; t <= bh * 2; t++) {
      set(bx - Math.ceil(t / 2), by + t, '8');
      set(bx + Math.ceil(t / 2), by + t, '7');
    }
    glints.push({ x: bx, y: by });
  }

  // 4. Шарики, если заданы (на ёлке желаний их нет: игрушки — только от людей)
  const bulbs: OgonekTreeBulb[] = [];
  const placed: [number, number][] = [];
  const big = W >= 80;
  // Мягкий тёплый отблеск на золотых бантах
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
    const h = TREE_PAL[c]!;
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
