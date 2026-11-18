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
  // Коробки подарков: тень, основа, свет
  A: '#5e1717', B: '#8e2622', C: '#b8473c',
  D: '#7a571c', E: '#a87d2c', F: '#d4aa55',
  G: '#183c3a', H: '#285e59', I: '#45827a',
  J: '#9c8b6c', K: '#c8b690', L: '#e8dcbc',
  // Ленты: тень, основа, свет
  M: '#8a6420', N: '#c29a3e', O: '#ead07c',
  P: '#24401f', Q: '#3f6634', S: '#6c9550',
  T: '#6a1818', U: '#a52a28', V: '#d4594d'
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
  // Под серединой ёлки оставляем место стволу и кадке: лапы туда не свисают
  const capY = bottom + span * 0.35;
  const capHalf = W * 0.13;
  const paintAt = (x: number, y: number, k: number, c: string) => {
    if (!inside(x, y)) return;
    if (y > capY && Math.abs(x - cx) < capHalf + (y - capY) * 0.6) return;
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
  for (let y = top + 1; y < bottom - 2; ) {
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

  // 6. Ствол и красная кадка
  const tw = Math.max(1, Math.round(W * 0.035));
  const trunkH = Math.max(2, Math.round(H * 0.025));
  // Ствол начинается под самой нижней лапой над кадкой
  let ty = bottom + 1;
  const potHalfMax = Math.round(W * 0.11);
  for (let x = Math.round(cx - potHalfMax); x <= Math.round(cx + potHalfMax); x++) {
    for (let y = H - 1; y > bottom - span; y--) if (tierAt(x, y) >= 0) { ty = Math.max(ty, y + 1); break; }
  }
  for (let y = ty; y < ty + trunkH; y++) {
    for (let x = Math.round(cx - tw); x <= Math.round(cx + tw); x++) set(x, y, x < cx - tw * 0.3 ? 'u' : x > cx + tw * 0.4 ? '1' : 'o');
  }
  const potTop = ty + trunkH;
  const potH = Math.max(4, Math.round(H * 0.07));
  for (let y = potTop; y < Math.min(H, potTop + potH); y++) {
    const v = (y - potTop) / potH;
    const half = Math.round(W * (0.11 - v * 0.03));
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      // Деревянная кадка: доски и два обруча
      let c = x < cx - half * 0.4 ? 's' : x > cx + half * 0.5 ? 'u' : 'o';
      if ((Math.round(x - cx) % Math.max(3, u1 * 4)) === 0) c = 'u';
      if (y === potTop) c = 't';
      if (Math.abs(y - potTop - potH * 0.25) < u1 * 0.6 || Math.abs(y - potTop - potH * 0.75) < u1 * 0.6) c = '0';
      set(x, y, c);
    }
  }

  // 7. Подарки под ёлкой: коробки в объёме (крышка, перед, бок), свет
  //    слева сверху, лента крест-накрест и бант. Бумага с узором.
  if (cfg.gifts) {
    type Tone = readonly [string, string, string]; // свет, основа, тень
    const gift = (x0: number, fy: number, w: number, h: number, d: number, box: Tone, rib: Tone, pattern: 'dots' | 'stripes' | 'plain') => {
      const top0 = fy - h;
      const skew = Math.max(2, Math.round(d * 0.7));
      const dd = Math.max(2, Math.round(d * 0.5));
      const rw = Math.max(3, Math.round(w * 0.14));
      const fx = x0 + Math.floor(w / 2);
      const tone = (t: Tone, i: number) => t[Math.max(0, Math.min(2, i))]!;
      const grain = (i: number) => (rand() < 0.06 ? i + (rand() < 0.5 ? -1 : 1) : i);
      // Бок справа: уходит вглубь и вверх
      for (let i = 1; i <= skew; i++) {
        const yo = Math.round((i * dd) / skew);
        for (let y = top0 - yo; y <= fy - yo; y++) {
          // Бок в тени; лента огибает его посередине глубины
          const onRib = i === Math.round(skew / 2) || i === Math.round(skew / 2) + 1;
          set(x0 + w - 1 + i, y, onRib ? rib[2] : tone(box, grain(2)));
        }
      }
      // Крышка
      for (let r = 1; r <= dd; r++) {
        const sh = Math.round((r * skew) / dd);
        for (let x = x0 + sh; x <= x0 + w - 1 + sh; x++) set(x, top0 - r, tone(box, grain(0)));
      }
      // Перед: верх светлее, низ и правый край в тени, узор бумаги
      for (let y = top0; y <= fy; y++) {
        for (let x = x0; x < x0 + w; x++) {
          let lv = 1;
          if (y <= top0 + 1) lv = 0;
          if (y >= fy - 1 || x >= x0 + w - 2) lv = 2;
          if (pattern === 'dots' && (x - x0) % 7 === 3 && (y - top0) % 7 === 3) { set(x, y, tone(rib, 0)); set(x + 1, y, tone(rib, 0)); set(x, y + 1, tone(rib, 1)); set(x + 1, y + 1, tone(rib, 1)); x++; continue; }
          if (pattern === 'stripes' && (x - x0 + (y - top0)) % 9 < 2) lv = Math.min(2, lv + 1);
          set(x, y, tone(box, grain(lv)));
        }
      }
      // Лента: вертикально по переду и по крышке вглубь, поперёк крышки
      for (let y = top0; y <= fy; y++) {
        for (let k2 = 0; k2 < rw; k2++) set(fx - Math.floor(rw / 2) + k2, y, k2 === 0 ? rib[0] : k2 === rw - 1 ? rib[2] : rib[1]);
      }
      for (let r = 1; r <= dd; r++) {
        const sh = Math.round((r * skew) / dd);
        for (let k2 = 0; k2 < rw; k2++) set(fx - Math.floor(rw / 2) + k2 + sh, top0 - r, k2 === 0 ? rib[0] : rib[1]);
      }
      const midR = Math.max(1, Math.round(dd / 2));
      const shMid = Math.round((midR * skew) / dd);
      for (let x = x0 + shMid; x <= x0 + w - 1 + shMid; x++) {
        set(x, top0 - midR, rib[1]);
        if (Math.max(2, Math.round(rw * 0.5)) > 1) set(x, top0 - midR + 1, rib[0]);
      }
      // Бант: две петли с тёмной серединой, узел и хвосты
      const bx = fx + shMid;
      const by = top0 - midR;
      const lr = Math.max(4, Math.round(w * 0.17));
      for (const side of [-1, 1]) {
        const ex = bx + side * lr * 0.85;
        const ey = by - lr * 0.45;
        for (let y = Math.floor(ey - lr * 0.7); y <= Math.ceil(ey + lr * 0.7); y++) {
          for (let x = Math.floor(ex - lr); x <= Math.ceil(ex + lr); x++) {
            const e = ((x - ex) / lr) ** 2 + ((y - ey) / (lr * 0.7)) ** 2;
            if (e > 1) continue;
            const hole = e < 0.3;
            set(x, y, hole ? rib[2] : y < ey - lr * 0.3 ? rib[0] : e > 0.75 && y > ey ? rib[2] : rib[1]);
          }
        }
      }
      for (let y = by - 3; y <= by + 1; y++) for (let x = bx - 2; x <= bx + 2; x++) set(x, y, Math.abs(x - bx) === 2 ? rib[2] : rib[1]);
      set(bx - 1, by - 2, rib[0]);
      for (let t = 1; t <= lr * 1.3; t++) {
        set(bx - 1 - Math.round(t * 0.6), by + t, t % 3 === 0 ? rib[2] : rib[1]);
        set(bx - 2 - Math.round(t * 0.6), by + t, rib[0]);
        set(bx + 1 + Math.round(t * 0.5), by + t, rib[1]);
        set(bx + 2 + Math.round(t * 0.5), by + t, rib[2]);
      }
    };
    const RED: Tone = ['C', 'B', 'A'];
    const MUSTARD: Tone = ['F', 'E', 'D'];
    const TEAL: Tone = ['I', 'H', 'G'];
    const CREAM: Tone = ['L', 'K', 'J'];
    const GOLD_R: Tone = ['O', 'N', 'M'];
    const GREEN_R: Tone = ['S', 'Q', 'P'];
    const RED_R: Tone = ['V', 'U', 'T'];
    const floor = Math.min(H - 8, potTop + potH - 1);
    // Сначала дальние, потом ближние
    gift(Math.round(cx - 118), floor, 48, 34, 14, TEAL, GOLD_R, 'plain');
    gift(Math.round(cx + 44), floor, 40, 42, 12, CREAM, RED_R, 'dots');
    gift(Math.round(cx - 80), floor + 4, 30, 22, 10, RED, GREEN_R, 'stripes');
    gift(Math.round(cx + 80), floor + 4, 34, 20, 10, MUSTARD, RED_R, 'plain');
    gift(Math.round(cx - 34), floor + 7, 22, 16, 8, RED, GOLD_R, 'dots');
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
