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
  /** Убранство: шишки, банты, гирлянды. Звезда на макушке. */
  decor: boolean;
  star: boolean;
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
    tiers: 9,
    half: ogonekTreeHalfWidth,
    baubles: 0,
    tinsel: 0,
    gifts: true,
    decor: false,
    star: false,
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
    tinsel: 0,
    gifts: false,
    decor: false,
    star: false,
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
  n: '#0c170a', // глубина хвои, почти чёрная
  m: '#1b2f12', // тень ветки
  l: '#31501c', // ветка
  k: '#506f26', // ветка на свету
  j: '#7f9338', // иголки на свету, жёлто-зелёные
  i: '#b7b863', // редкие блики на кончиках
  r: '#b3262a', // лента красная
  o: '#7a4a22', // лента коричневая, шишка
  w: '#4d6e3f', // лента зелёная
  s: '#c98a3f', // баранка
  t: '#ebbd72', // баранка, блик
  u: '#8e5a26', // баранка, тень
  v: '#efe2c4', // бумага флажка
  x: '#4f7e77', // флажок бирюзовый, выцветший
  y: '#cf9c3c', // флажок охра
  z: '#8f9b6c', // флажок шалфей
  // Коробки подарков: тень, основа, свет — яркие, праздничные
  A: '#a01f2a', B: '#df3b3d', C: '#ff7466',
  D: '#c48a12', E: '#f5bf2a', F: '#ffe37c',
  G: '#16733f', H: '#27a95d', I: '#68dc90',
  J: '#157a80', K: '#25acb2', L: '#80e3dc',
  M: '#b9466f', N: '#ee7ca2', O: '#ffb8cc',
  P: '#5b3a95', Q: '#8b63cf', R: '#c2a6f2',
  // Ленты: тень, основа, свет
  S: '#c2bbb0', T: '#f6f2ea', U: '#ffffff',
  V: '#b98a1e', W: '#f2c63f', X: '#fff19c',
  Y: '#a51d2a', Z: '#e5404a', '!': '#ff9196',
  '#': '#1b7b40', $: '#33b363', '%': '#8ae6a2'
};

/** Тона хвои от тени к свету. */
const NEEDLE = ['n', 'm', 'l', 'k', 'j'];

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

  // 1. Ель как растёт в природе: ветки отходят от ствола мутовками
  //    (кругами) через неравный шаг. Каждая ветка повёрнута вокруг ствола:
  //    дальние темнее и рисуются первыми, ближние светлее и ложатся поверх.
  //    Ветка провисает и загибает кончик вверх; от неё в обе стороны идут
  //    боковые веточки, на них иголки. Свет слева сверху.
  const span = (bottom - top) / T;
  const paintAt = (x: number, y: number, k: number, c: string) => {
    if (!inside(x, y)) return;
    tierOf[y * W + x] = k;
    px[y * W + x] = c;
  };
  const shade = (lv: number) => NEEDLE[Math.max(0, Math.min(4, Math.round(lv)))]!;

  // Тёмная глубина кроны у ствола: видна в просветах между ветками
  for (let y = top + 2; y <= bottom; y++) {
    const w = cfg.half(y / H) * W * 0.5;
    for (let x = Math.ceil(cx - w); x <= Math.floor(cx + w); x++) paintAt(x, y, 0, rand() < 0.08 ? 'm' : 'n');
  }

  const needle = (x: number, y: number, lv: number) => paintAt(Math.round(x), Math.round(y), 0, shade(lv + (rand() < 0.25 ? (rand() < 0.5 ? -1 : 1) : 0)));

  /**
   * Лапа: стебель по направлению (ux, uy) с провисом под своим весом,
   * боковые веточки с иголками и — у главных лап — 2–3 лапы поменьше,
   * отходящие под разными углами. Так ветки не лежат одинаковыми лучами.
   */
  const bough = (x0: number, y0: number, ang: number, len: number, lv: number, sag: number, level: number) => {
    const steps = Math.max(3, Math.ceil(len * 1.2));
    const pts: { x: number; y: number; t: number }[] = [];
    let x = x0;
    let y = y0;
    let a = ang;
    const bend = (rand() - 0.5) * 0.5 / steps;
    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      pts.push({ x, y, t });
      // Вес тянет вниз к середине, кончик чуть приподнят
      const g = t < 0.75 ? sag : -sag * 0.8;
      const dirX = Math.cos(a);
      a += bend + g * (dirX >= 0 ? 1 : -1) / steps;
      x += Math.cos(a) * (len / steps);
      y += Math.sin(a) * (len / steps);
    }
    const twStep = Math.max(2, Math.round(1.5 * sc));
    for (let st = Math.round(steps * 0.1); st < pts.length - 1; st += twStep) {
      const p0 = pts[st]!;
      const p1 = pts[st + 1]!;
      const al = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
      const ux = (p1.x - p0.x) / al;
      const uy = (p1.y - p0.y) / al;
      for (const sgn of [-1, 1]) {
        const ta = (0.6 + rand() * 0.5) * sgn;
        let vx = ux * Math.cos(ta) - uy * Math.sin(ta);
        let vy = ux * Math.sin(ta) + uy * Math.cos(ta) + 0.3;
        const vl = Math.hypot(vx, vy);
        vx /= vl; vy /= vl;
        const lt = ((1 - p0.t * 0.6) * len * 0.2 + rand() * 2 * sc) * (level ? 0.8 : 1);
        const lvTw = lv + (vy < uy ? 0.35 : -0.35) + p0.t * 0.7;
        for (let q = 0; q <= lt; q++) {
          const nx = p0.x + vx * q;
          const ny = p0.y + vy * q;
          const tq = q / Math.max(1, lt);
          needle(nx, ny, lvTw - 0.6 + tq * 0.9);
          const nl = 1 + Math.floor(rand() * Math.max(1, sc * 0.7));
          for (let r = 1; r <= nl; r++) {
            needle(nx - vy * r + vx * r * 0.5, ny + vx * r + vy * r * 0.5, lvTw - 0.3 + tq);
            needle(nx + vy * r + vx * r * 0.5, ny - vx * r + vy * r * 0.5, lvTw + 0.4 + tq);
          }
        }
        if (rand() < 0.05 && lv > 1.8) paintAt(Math.round(p0.x + vx * lt), Math.round(p0.y + vy * lt), 0, 'i');
      }
    }
    for (const p of pts) if (p.t > 0.06) needle(p.x, p.y, lv - 0.8 + p.t);
    // Лапы поменьше от главной
    if (level === 0) {
      const subs = 2 + Math.floor(rand() * 2);
      for (let k2 = 0; k2 < subs; k2++) {
        const pt = pts[Math.floor(steps * (0.3 + rand() * 0.45))]!;
        const off = (0.35 + rand() * 0.55) * (rand() < 0.5 ? -1 : 1);
        bough(pt.x, pt.y, ang + off, len * (0.35 + rand() * 0.25), lv + 0.15, sag * 0.8, 1);
      }
    }
  };

  type Branch = { x0: number; y0: number; dir: number; depth: number; L: number };
  const branches: Branch[] = [];
  // Нижние мутовки уходят ниже кроны: лапы закрывают низ до подарков
  for (let y = top + 1; y < bottom + span * 0.7; ) {
    const tv = (y - top) / (bottom - top);
    const reach = cfg.half(Math.min(bottom, y + span * 0.3) / H) * W;
    const count = 7 + Math.round(tv * 7);
    const rot = rand() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const th = rot + (i * Math.PI * 2) / count + (rand() - 0.5) * 0.8;
      const dir = Math.cos(th);
      const depth = Math.sin(th);
      // Ветка, что смотрит на нас, видна от середины кроны и короче
      const front = Math.max(0, depth) * (1 - Math.abs(dir));
      const x0 = cx + (dir * 0.5 + (rand() - 0.5) * 0.6) * reach * front;
      const L = reach * (0.75 + rand() * 0.4) * (0.55 + 0.45 * Math.abs(dir));
      branches.push({ x0, y0: y + depth * sc * 2, dir, depth, L });
    }
    y += Math.max(2, (3.5 + rand() * 4) * sc * (0.55 + 0.45 * tv));
  }
  branches.sort((a, b) => a.depth - b.depth);

  for (const b of branches) {
    const sideLight = b.dir < 0 ? 0.35 : -0.35;
    const lv = 0.2 + (b.depth + 1) * 0.75 + sideLight;
    // Угол: от почти горизонтали до заметного наклона вниз; ближние круче
    // Угол: боковые — от почти горизонтали до наклона вниз; те, что смотрят
    // на нас, идут круто вниз и закрывают середину кроны
    const frontness = Math.max(0, b.depth) * (1 - Math.abs(b.dir));
    const side = 0.1 + rand() * 0.35;
    const ang = b.dir >= 0
      ? side + frontness * (Math.PI / 2 - side) * (0.6 + rand() * 0.4)
      : Math.PI - side - frontness * (Math.PI / 2 - side) * (0.6 + rand() * 0.4);
    bough(b.x0, b.y0, ang, Math.max(3, b.L * (1 - frontness * 0.35)), lv, 0.08 + rand() * 0.18, 0);
  }

  // 2. Тень яруса на ярус ниже
  const base = px.slice();
  const darker: Record<string, string> = { i: 'k', j: 'k', k: 'l', l: 'm', m: 'n', n: 'n' };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = tierAt(x, y);
      if (k < 0 || base[y * W + x] === '.') continue;
      for (let d = 1; d <= u1 * 3; d++) {
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
  const cones = cfg.decor ? Math.round(4 + 8 * Math.min(1, sc)) : 0;
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
  const bows = cfg.decor ? Math.max(1, Math.round(cfg.tinsel * 0.6)) : 0;
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
  const sf = cfg.star ? u1 : 0;
  const starX = Math.round(cx - 4.5 * sf + 0.5);
  const starY = top - 7 * sf;
  if (sf) STAR.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    for (let dy = 0; dy < sf; dy++) for (let dx = 0; dx < sf; dx++) set(starX + x * sf + dx, starY + y * sf + dy, c);
  }));

  // 6. Ствол и кадки нет: низ ёлки закрывают нижние лапы и горка подарков.

  // 7. Подарки горкой под ёлкой: яркие коробки в объёме (крышка, перед, бок),
  //    контрастная лента крест-накрест, пышный бант с кудрявыми хвостиками,
  //    весёлый узор на бумаге. Дальние рисуются первыми.
  if (cfg.gifts) {
    type Tone = readonly [string, string, string]; // тень, основа, свет
    type Pattern = 'dots' | 'stripes' | 'stars' | 'plain';
    const gift = (x0: number, fy: number, w: number, h: number, d: number, box: Tone, rib: Tone, pattern: Pattern, ink: string) => {
      const top0 = fy - h;
      const skew = Math.max(2, Math.round(d * 0.7));
      const dd = Math.max(2, Math.round(d * 0.5));
      const rw = Math.max(3, Math.round(w * 0.15));
      const fx = x0 + Math.floor(w / 2);
      const [bS, bM, bL] = box;
      const [rS, rM, rL] = rib;
      // Бок: в тени, лента огибает его посередине
      for (let i = 1; i <= skew; i++) {
        const yo = Math.round((i * dd) / skew);
        const mid = Math.abs(i - skew / 2) < 1;
        for (let y = top0 - yo; y <= fy - yo; y++) set(x0 + w - 1 + i, y, mid ? rS : bS);
      }
      // Крышка — самая светлая
      for (let r = 1; r <= dd; r++) {
        const sh = Math.round((r * skew) / dd);
        for (let x = x0 + sh; x <= x0 + w - 1 + sh; x++) set(x, top0 - r, bL);
      }
      // Перед с узором
      for (let y = top0; y <= fy; y++) {
        for (let x = x0; x < x0 + w; x++) {
          let c = y === top0 ? bL : y >= fy - 1 || x >= x0 + w - 2 ? bS : bM;
          const lx = x - x0;
          const ly = y - top0;
          if (pattern === 'stripes' && (lx + ly) % 10 < 3 && c === bM) c = ink;
          if (pattern === 'dots' && ((lx % 8 === 3 && ly % 8 === 3) || (lx % 8 === 7 && ly % 8 === 7))) c = ink;
          if (pattern === 'dots' && ((lx % 8 === 4 && ly % 8 === 3) || (lx % 8 === 3 && ly % 8 === 4))) c = ink;
          set(x, y, c);
        }
      }
      if (pattern === 'stars') {
        for (let sy = top0 + 4; sy < fy - 3; sy += 9) {
          for (let sx = x0 + 4 + ((sy - top0) % 18 ? 4 : 0); sx < x0 + w - 4; sx += 9) {
            set(sx, sy, ink); set(sx - 1, sy, ink); set(sx + 1, sy, ink); set(sx, sy - 1, ink); set(sx, sy + 1, ink);
          }
        }
      }
      // Лента крест-накрест: по переду, по крышке вглубь и поперёк
      for (let y = top0; y <= fy; y++) {
        for (let k2 = 0; k2 < rw; k2++) set(fx - Math.floor(rw / 2) + k2, y, k2 === 0 ? rL : k2 === rw - 1 ? rS : rM);
      }
      for (let r = 1; r <= dd; r++) {
        const sh = Math.round((r * skew) / dd);
        for (let k2 = 0; k2 < rw; k2++) set(fx - Math.floor(rw / 2) + k2 + sh, top0 - r, k2 === rw - 1 ? rM : rL);
      }
      const midR = Math.max(1, Math.round(dd / 2));
      const shMid = Math.round((midR * skew) / dd);
      for (let x = x0 + shMid; x <= x0 + w - 1 + shMid; x++) set(x, top0 - midR, rM);
      // Пышный бант: две большие петли с бликом, узел, кудрявые хвостики
      const bx = fx + shMid;
      const by = top0 - midR;
      const lr = Math.max(5, Math.round(w * 0.24));
      for (const side of [-1, 1]) {
        const ex = bx + side * lr * 0.9;
        const ey = by - lr * 0.5;
        for (let y = Math.floor(ey - lr * 0.75); y <= Math.ceil(ey + lr * 0.75); y++) {
          for (let x = Math.floor(ex - lr); x <= Math.ceil(ex + lr); x++) {
            const e = ((x - ex) / lr) ** 2 + ((y - ey) / (lr * 0.75)) ** 2;
            if (e > 1) continue;
            let c = rM;
            if (e < 0.22) c = rS;
            else if (e > 0.72 && y > ey) c = rS;
            else if (y < ey - lr * 0.3 && x * side < ex * side) c = rL;
            set(x, y, c);
          }
        }
      }
      for (let y = by - 4; y <= by + 1; y++) for (let x = bx - 2; x <= bx + 2; x++) set(x, y, Math.abs(x - bx) === 2 || y === by + 1 ? rS : rM);
      set(bx - 1, by - 3, rL); set(bx, by - 3, rL);
      for (const side of [-1, 1]) {
        const len = Math.round(lr * 1.6);
        for (let t = 0; t <= len; t++) {
          const x = Math.round(bx + side * (2 + t * 0.55) + Math.sin(t * 0.6) * 2 * side);
          const y = by + 1 + t;
          set(x, y, t % 4 === 0 ? rL : rM);
          set(x + side, y, rS);
        }
      }
    };
    const RED: Tone = ['A', 'B', 'C'];
    const YELLOW: Tone = ['D', 'E', 'F'];
    const GREEN: Tone = ['G', 'H', 'I'];
    const TURQ: Tone = ['J', 'K', 'L'];
    const PINK: Tone = ['M', 'N', 'O'];
    const VIOLET: Tone = ['P', 'Q', 'R'];
    const R_WHITE: Tone = ['S', 'T', 'U'];
    const R_GOLD: Tone = ['V', 'W', 'X'];
    const R_RED: Tone = ['Y', 'Z', '!'];
    const R_GREEN: Tone = ['#', '$', '%'];
    const floor = H - 4;
    // Задний ряд
    gift(Math.round(cx - 150), floor - 6, 46, 40, 14, VIOLET, R_GOLD, 'stars', 'X');
    gift(Math.round(cx - 64), floor - 8, 44, 46, 14, RED, R_WHITE, 'dots', 'U');
    gift(Math.round(cx + 18), floor - 7, 50, 38, 14, GREEN, R_RED, 'plain', 'I');
    gift(Math.round(cx + 96), floor - 6, 42, 44, 12, YELLOW, R_RED, 'stripes', 'C');
    // Передний ряд
    gift(Math.round(cx - 118), floor, 38, 26, 10, TURQ, R_RED, 'dots', 'U');
    gift(Math.round(cx - 30), floor, 34, 24, 10, PINK, R_WHITE, 'stars', 'U');
    gift(Math.round(cx + 48), floor, 40, 28, 10, RED, R_GOLD, 'stripes', 'F');
    gift(Math.round(cx + 120), floor, 30, 22, 8, TURQ, R_GOLD, 'stars', 'X');
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
