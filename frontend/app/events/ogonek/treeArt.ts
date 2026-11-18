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

export type OgonekTreeBulb = { x: number; y: number; color: string; delay: number; /** Диаметр свечения в пикселях ёлки. */ size?: number };
/** Стекло окна в долях картинки и маска стекла (куда видно снег за окном). */
export type OgonekTreeWindow = { x: number; y: number; w: number; h: number; pw: number; ph: number; mask: string };
type TreeArt = { url: string; bulbs: OgonekTreeBulb[]; w: number; h: number; window?: OgonekTreeWindow };

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
  /** Сцена: тёмная комната, силуэты лап на фоне, свечи и их тёплый свет. */
  scene: boolean;
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
    star: true,
    scene: true,
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
    scene: false,
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
  // Подарки в старой бумаге: кремовая и крафтовая (тень, основа, свет)
  A: '#8f7c5e', B: '#c9b58f', C: '#e6d6b2',
  D: '#7a5a38', E: '#a8834f', F: '#c9a46c',
  // Ленты: красная и зелёная, приглушённые
  G: '#6e1d18', H: '#9e3226', I: '#c4553f',
  J: '#1f4228', K: '#2f6338', L: '#4f8752',
  // Бумажный бант кремовый
  M: '#9a8662', N: '#d2c19a', O: '#efe3c4',
  // Пятна краски на бумаге
  P: '#b0533f', Q: '#6c7e52',
  // Свечи: воск (тень, основа, свет) и золотая прищепка
  S: '#c2bbb0', T: '#f6f2ea', U: '#ffffff',
  V: '#b98a1e', W: '#f2c63f', X: '#fff19c',
  // Фоновые лапы: тёмные, сливово-зелёные
  '(': '#1c1220', ')': '#201628', '[': '#241b2a', ']': '#2a2230', '{': '#2a2230',
  // Пламя свечи
  // Звезда: контур, тень, золото, свет, блик
  '&': '#5c3f10', '*': '#8a6418', '+': '#c99a2e', '=': '#f1d27a', '~': '#fff4c4',
  '<': '#fff3c4', '>': '#ffc04a', '^': '#ff7a22'
};

/** Тона хвои от тени к свету. */
const NEEDLE = ['n', 'm', 'l', 'k', 'j'];
/** Тона фоновых лап. */
const BACK = ['(', '(', ')', '[', ']'];

const BAUBLE_COLORS = ['2', '3', '8', '9', 'h', 'b', 'c', 'g'];
const GLOW_COLORS = new Set(['3', '9', 'c', 'h']);

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
  // ramp и mark меняются для фоновых силуэтов: свои цвета и «не ёлка»
  let ramp: readonly string[] = NEEDLE;
  let mark = 0;
  const shade = (lv: number) => ramp[Math.max(0, Math.min(4, Math.round(lv)))]!;

  // Тёмная глубина кроны у ствола: видна в просветах между ветками
  for (let y = top + 2; y <= bottom; y++) {
    const w = cfg.half(y / H) * W * 0.5;
    for (let x = Math.ceil(cx - w); x <= Math.floor(cx + w); x++) paintAt(x, y, 0, rand() < 0.08 ? 'm' : 'n');
  }

  const needle = (x: number, y: number, lv: number) => paintAt(Math.round(x), Math.round(y), mark, shade(lv + (rand() < 0.25 ? (rand() < 0.5 ? -1 : 1) : 0)));

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
        if (rand() < 0.05 && lv > 1.8) paintAt(Math.round(p0.x + vx * lt), Math.round(p0.y + vy * lt), mark, mark < 0 ? ramp[4]! : 'i');
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
    // Размах лап с запасом на боковые лапы: ёлка не вылезает за края картинки
    const reach = Math.min(cfg.half(Math.min(bottom, y + span * 0.3) / H) * W, W * 0.36);
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

  // 5. Звезда на макушке: восьмиконечная, как стеклянно-золотая игрушка.
  //    Четыре длинных луча и четыре коротких, у каждого две грани — светлая
  //    и тёмная (свет слева сверху), по оси луча блестит ребро. Стоит на
  //    стержне над верхушкой; центр светится и подсвечивает макушку.
  let starCenter: { x: number; y: number } | null = null;
  if (cfg.star) {
    const R = Math.round(W * 0.085);
    const r2 = R * 0.62;
    const ri = R * 0.34;
    const scx = Math.round(cx);
    const scy = Math.round(top - R * 1.05);
    starCenter = { x: scx, y: scy };
    // Многоугольник звезды: 16 вершин, внешние через одну
    const poly: [number, number][] = [];
    for (let k2 = 0; k2 < 16; k2++) {
      const a = -Math.PI / 2 + (k2 * Math.PI) / 8;
      const rr = k2 % 2 ? ri : (k2 / 2) % 2 ? r2 : R;
      poly.push([scx + Math.cos(a) * rr, scy + Math.sin(a) * rr]);
    }
    const insideStar = (x: number, y: number) => {
      let inn = false;
      for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        const [xa, ya] = poly[a]!;
        const [xb, yb] = poly[b]!;
        if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inn = !inn;
      }
      return inn;
    };
    // Стержень от звезды к верхушке
    for (let y = scy + Math.round(R * 0.5); y <= top + 4; y++) {
      set(scx - 1, y, '*'); set(scx, y, '+');
    }
    const Lx = -0.55;
    const Ly = -0.83;
    for (let y = scy - R - 1; y <= scy + R + 1; y++) {
      for (let x = scx - R - 1; x <= scx + R + 1; x++) {
        const px0 = x + 0.5;
        const py0 = y + 0.5;
        if (!insideStar(px0, py0)) continue;
        const edge = !insideStar(px0 - 1, py0) || !insideStar(px0 + 1, py0) || !insideStar(px0, py0 - 1) || !insideStar(px0, py0 + 1);
        const th = Math.atan2(py0 - scy, px0 - scx);
        // Ближайшая ось луча и сторона грани
        const k2 = Math.round((th + Math.PI / 2) / (Math.PI / 4));
        const ax = -Math.PI / 2 + k2 * (Math.PI / 4);
        let dlt = th - ax;
        dlt = Math.atan2(Math.sin(dlt), Math.cos(dlt));
        const side = dlt >= 0 ? 1 : -1;
        // Нормаль грани — ось луча, повёрнутая в сторону грани
        const nx = Math.cos(ax + side * Math.PI / 2);
        const ny = Math.sin(ax + side * Math.PI / 2);
        const lit = nx * Lx + ny * Ly;
        const dist = Math.hypot(px0 - scx, py0 - scy);
        let c = lit > 0.35 ? '=' : lit > -0.25 ? '+' : '*';
        if (Math.abs(dlt) < 0.05 + 0.6 / Math.max(1, dist) && lit > -0.6) c = '~'; // ребро луча
        if (dist < ri * 0.55) c = '~'; // светящийся центр
        if (edge) c = '&';
        set(x, y, c);
      }
    }
  }

  // 6. Ствола и кадки нет: низ ёлки закрывают нижние лапы и горка подарков.

  // Ретро-свечи на прищепках, как ставили на Рождество: на верхних кромках
  // ближних лап, не теснее друг к другу. Их пламя светит на хвою (см. рендер).
  const candles: { x: number; y: number }[] = [];
  if (cfg.scene) {
    const want = 22;
    for (let tries = 0; candles.length < want && tries < 4000; tries++) {
      const y = Math.round(top + span * 0.8 + rand() * (bottom - top - span * 0.6));
      const x = Math.round(cx + (rand() * 2 - 1) * cfg.half(y / H) * W * 0.82);
      if (tierAt(x, y) < 0 || !'lkj'.includes(get(x, y))) continue;
      if (tierAt(x, y - 3) >= 0 && 'lkj'.includes(get(x, y - 3))) continue; // нужна кромка лапы, а не её середина
      if (candles.some((c) => Math.hypot(c.x - x, (c.y - y) * 1.3) < 30)) continue;
      candles.push({ x, y });
    }
    for (const c of candles) {
      const { x, y } = c;
      // Прищепка
      set(x - 1, y + 1, 'V'); set(x, y + 1, 'W'); set(x + 1, y + 1, 'V'); set(x, y + 2, 'V');
      // Свеча: 3 пикселя шириной, свет слева, наплыв воска сверху
      const hgt = 7 + Math.floor(rand() * 3);
      for (let yy = y - hgt; yy <= y; yy++) {
        set(x - 1, yy, 'U'); set(x, yy, 'T'); set(x + 1, yy, 'S');
      }
      set(x - 1, y - hgt, 'T'); set(x + 1, y - hgt + 2, 'U');
      // Фитиль и пламя
      const fy = y - hgt - 1;
      set(x, fy, '0');
      set(x, fy - 1, '<'); set(x, fy - 2, '<'); set(x - 1, fy - 1, '>'); set(x + 1, fy - 1, '^');
      set(x, fy - 3, '>'); set(x, fy - 4, '^');
      c.y = fy - 2;
      bulbs.push({ x: c.x / W, y: c.y / H, color: '#ffb347', delay: -((c.x * 0.37 + c.y * 0.11) % 3) });
    }
  }

  // Звезда светит тепло, как ещё одна свеча
  if (starCenter) {
    candles.push({ x: starCenter.x, y: starCenter.y });
    bulbs.push({ x: starCenter.x / W, y: starCenter.y / H, color: '#ffd27a', delay: 0, size: 24 });
  }

  // 7. Подарки горкой под ёлкой — как в старой открытке: коробки в кремовой
  //    и крафтовой бумаге с потёртыми пятнами краски, двойные ленты (красная
  //    с зелёной), крупные мятые бумажные банты. Дальний ряд рисуется первым.
  if (cfg.gifts) {
    type Tone = readonly [string, string, string]; // тень, основа, свет
    // Плавный шум для пятен на бумаге
    const hash = (ix: number, iy: number) => {
      let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ cfg.seed;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
    };
    const vnoise = (x: number, y: number) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * sx;
      const b = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * sx;
      return a + (b - a) * sy;
    };
    const paper = (x: number, y: number, t: Tone, lv: number, seed: number) => {
      const n = vnoise(x * 0.16 + seed, y * 0.16 + seed * 1.7);
      if (n > 0.78 && rand() < 0.6) return 'P'; // красное пятно
      if (n < 0.13 && rand() < 0.45) return 'Q'; // зелёное пятно
      if (rand() < 0.1) return t[Math.max(0, Math.min(2, lv + (rand() < 0.5 ? -1 : 1)))]!;
      return t[lv]!;
    };
    const band = (k2: number, rwid: number, r: Tone) => (k2 === 0 ? r[2] : k2 === rwid - 1 ? r[0] : r[1]);
    /** Бумажный бант: две петли в стороны и чуть вверх, узел, хвосты. */
    const drawBow = (bx: number, by: number, R: number, bow: Tone, seed: number) => {
      // Две петли, раскинутые в стороны и чуть вверх, между ними щель у узла
      for (const side of [-1, 1]) {
        const rx = R * 0.62;
        const ry = R * 0.4;
        const ex = bx + side * R * 0.66;
        const ey = by - R * 0.22;
        const rot = side * -0.42;
        const cr = Math.cos(rot);
        const sr = Math.sin(rot);
        for (let y = Math.floor(ey - R); y <= Math.ceil(ey + R); y++) {
          for (let x = Math.floor(ex - R); x <= Math.ceil(ex + R); x++) {
            const dx = x - ex;
            const dy = y - ey;
            const ux = dx * cr + dy * sr;
            const uy = -dx * sr + dy * cr;
            const ang = Math.atan2(uy, ux);
            const wob = 1 + 0.08 * Math.sin(ang * 3 + seed);
            const e = Math.hypot(ux / rx, uy / ry) / wob;
            if (e > 1) continue;
            if (Math.abs(x - bx) < 2) continue; // щель между петлями у узла
            let c = bow[1];
            if (e < 0.42 && ux * side > -rx * 0.2) c = bow[0]; // просвет петли
            else if (e > 0.78 && uy > 0) c = bow[0];
            else if (uy < -ry * 0.35) c = bow[2];
            else if (Math.abs(uy) < 0.7 && ux * side < 0) c = bow[0]; // складка к узлу
            if (rand() < 0.04) c = bow[rand() < 0.5 ? 0 : 2];
            set(x, y, c);
          }
        }
      }
      // Узел и хвосты
      for (let y = by - 3; y <= by + 2; y++) for (let x = bx - 3; x <= bx + 3; x++) set(x, y, Math.abs(x - bx) === 3 || y === by + 2 ? bow[0] : bow[1]);
      set(bx - 1, by - 2, bow[2]); set(bx, by - 2, bow[2]);
      for (const side of [-1, 1]) {
        for (let t = 0; t <= R * 0.75; t++) {
          const x = Math.round(bx + side * (2 + t * 0.7) + Math.sin(t * 0.5) * 1.2);
          const y = by + 2 + t;
          set(x, y, bow[1]); set(x + side, y, bow[0]); set(x - side, y, bow[2]);
        }
      }
    };
    const gift = (x0: number, fy: number, w: number, h: number, d: number, pap: Tone, ribA: Tone, ribB: Tone, bow: Tone, seed: number, withBow = true) => {
      const top0 = fy - h;
      const skew = Math.max(3, Math.round(d * 0.75));
      const dd = Math.max(3, Math.round(d * 0.55));
      const rwA = Math.max(4, Math.round(w * 0.13));
      const rwB = Math.max(2, Math.round(rwA * 0.55));
      const fx = x0 + Math.floor(w * (0.38 + (seed % 3) * 0.08));
      // Бок
      for (let i = 1; i <= skew; i++) {
        const yo = Math.round((i * dd) / skew);
        for (let y = top0 - yo; y <= fy - yo; y++) {
          let c = paper(x0 + w + i, y, pap, 0, seed);
          const ly = y - (top0 - yo);
          if (ly >= h * 0.42 && ly < h * 0.42 + rwA) c = ribA[0];
          set(x0 + w - 1 + i, y, c);
        }
      }
      // Крышка
      for (let r = 1; r <= dd; r++) {
        const sh = Math.round((r * skew) / dd);
        for (let x = x0 + sh; x <= x0 + w - 1 + sh; x++) set(x, top0 - r, paper(x, top0 - r, pap, 2, seed));
      }
      // Перед
      for (let y = top0; y <= fy; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const lv = y <= top0 + 1 ? 2 : y >= fy - 1 || x >= x0 + w - 2 ? 0 : 1;
          set(x, y, paper(x, y, pap, lv, seed));
        }
      }
      // Ленты: широкая и рядом узкая другого цвета; по переду, по крышке и вокруг бока
      for (let y = top0 - dd; y <= fy; y++) {
        const onTop = y < top0;
        const sh = onTop ? Math.round(((top0 - y) * skew) / dd) : 0;
        for (let k2 = 0; k2 < rwA; k2++) set(fx + k2 + sh, y, band(k2, rwA, ribA));
        for (let k2 = 0; k2 < rwB; k2++) set(fx + rwA + 1 + k2 + sh, y, band(k2, rwB, ribB));
      }
      const yb = top0 + Math.round(h * 0.42);
      for (let x = x0; x < x0 + w; x++) {
        if (x >= fx && x < fx + rwA + rwB + 1) continue;
        for (let k2 = 0; k2 < rwA; k2++) set(x, yb + k2, band(k2, rwA, ribA));
      }
      // Бумажный бант на крышке
      const bx = fx + Math.floor(rwA / 2) + Math.round(skew / 2);
      const by = top0 - Math.round(dd / 2);
      if (withBow) drawBow(bx, by, Math.max(6, Math.round(Math.min(w, 60) * 0.26)), bow, seed);
      // Где крышка: сюда можно поставить коробку сверху
      return { top: top0 - Math.round(dd / 2), left: x0 + Math.round(skew / 2), w };
    };
    /**
     * Круглая шляпная коробка: цилиндр с крышкой-овалом, бок затенён справа,
     * лента крест-накрест через крышку, бант сверху.
     */
    const hatbox = (cx0: number, fy: number, r: number, h: number, pap: Tone, ribA: Tone, ribB: Tone, bow: Tone, seed: number) => {
      const ry = Math.max(3, r * 0.34);
      const ell = (dx: number) => ry * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2));
      const topY = fy - h;
      const rwA = Math.max(3, Math.round(r * 0.22));
      const rwB = Math.max(2, Math.round(rwA * 0.55));
      for (let x = Math.ceil(cx0 - r); x <= Math.floor(cx0 + r); x++) {
        const dx = x - cx0;
        const e = ell(dx);
        const lv = dx < -r * 0.35 ? 2 : dx > r * 0.5 ? 0 : 1;
        for (let y = Math.round(topY + e); y <= Math.round(fy + e); y++) {
          let c = paper(x, y, pap, lv, seed);
          if (y <= topY + e + 3) c = y === Math.round(topY + e + 3) ? pap[0] : paper(x, y, pap, Math.min(2, lv + 1), seed); // кромка крышки
          if (Math.abs(dx) < rwA / 2) c = band(Math.floor(dx + rwA / 2), rwA, ribA);
          else if (dx >= rwA / 2 + 1 && dx < rwA / 2 + 1 + rwB) c = band(Math.floor(dx - rwA / 2 - 1), rwB, ribB);
          set(x, y, c);
        }
      }
      // Крышка
      for (let y = Math.floor(topY - ry); y <= Math.ceil(topY + ry); y++) {
        for (let x = Math.floor(cx0 - r); x <= Math.ceil(cx0 + r); x++) {
          const q = ((x - cx0) / r) ** 2 + ((y - topY) / ry) ** 2;
          if (q > 1) continue;
          let c = q > 0.82 ? pap[1] : paper(x, y, pap, 2, seed);
          if (Math.abs(x - cx0) < rwA / 2) c = ribA[2];
          else if (Math.abs(y - topY) < 1.2) c = ribA[1];
          set(x, y, c);
        }
      }
      drawBow(Math.round(cx0), Math.round(topY), Math.max(6, Math.round(r * 0.5)), bow, seed);
      return { top: topY, left: cx0 - r * 0.6, w: r * 1.2 };
    };

    const CREAM: Tone = ['A', 'B', 'C'];
    const KRAFT: Tone = ['D', 'E', 'F'];
    const RIB_RED: Tone = ['G', 'H', 'I'];
    const RIB_GREEN: Tone = ['J', 'K', 'L'];
    const BOW_CREAM: Tone = ['M', 'N', 'O'];
    const floor = H - 4;
    const X = (dx: number) => Math.round(cx + dx);
    type Top = { top: number; left: number; w: number };
    /** Коробка на крышке другой: ставим по центру крышки, чуть сдвинув. */
    const on = (t: Top, w: number, h: number, shift: number, pap: Tone, a: Tone, b: Tone, bow: Tone, seed: number) =>
      gift(Math.round(t.left + (t.w - w) / 2 + shift), t.top + 2, w, h, 12, pap, a, b, bow, seed);

    // Дальний ряд: высокие и широкие, на некоторых стоят ещё коробки
    gift(X(-152), floor - 30, 32, 64, 14, CREAM, RIB_RED, RIB_GREEN, BOW_CREAM, 1);
    hatbox(X(-92), floor - 28, 26, 34, KRAFT, RIB_GREEN, RIB_RED, RIB_RED, 2);
    const wide = gift(X(-56), floor - 30, 70, 24, 16, CREAM, RIB_GREEN, RIB_RED, BOW_CREAM, 3, false);
    // На широкой коробке — круглая шляпная
    hatbox(wide.left + wide.w / 2 - 4, wide.top + 4, 17, 20, KRAFT, RIB_RED, RIB_GREEN, RIB_GREEN, 4);
    const tall = gift(X(26), floor - 30, 40, 56, 14, KRAFT, RIB_RED, RIB_GREEN, BOW_CREAM, 5, false);
    on(tall, 24, 18, 2, CREAM, RIB_GREEN, RIB_RED, RIB_RED, 6);
    gift(X(84), floor - 30, 48, 44, 16, CREAM, RIB_GREEN, RIB_RED, RIB_RED, 7);
    // Средний ряд
    const mid1 = gift(X(-138), floor - 15, 46, 28, 14, KRAFT, RIB_GREEN, RIB_RED, BOW_CREAM, 8, false);
    on(mid1, 20, 30, 3, CREAM, RIB_RED, RIB_GREEN, RIB_GREEN, 9);
    hatbox(X(-60), floor - 14, 18, 24, CREAM, RIB_RED, RIB_GREEN, RIB_GREEN, 10);
    gift(X(-28), floor - 15, 58, 36, 16, CREAM, RIB_RED, RIB_GREEN, BOW_CREAM, 11);
    gift(X(50), floor - 15, 34, 50, 12, CREAM, RIB_GREEN, RIB_RED, RIB_RED, 12);
    const mid2 = gift(X(96), floor - 15, 50, 28, 14, KRAFT, RIB_RED, RIB_GREEN, RIB_GREEN, 13, false);
    on(mid2, 32, 22, -2, CREAM, RIB_GREEN, RIB_RED, BOW_CREAM, 14);
    // Передний ряд: низкие, маленькие, длинные
    gift(X(-156), floor, 40, 26, 12, CREAM, RIB_GREEN, RIB_RED, RIB_RED, 15);
    gift(X(-106), floor, 64, 20, 14, KRAFT, RIB_RED, RIB_GREEN, BOW_CREAM, 16);
    hatbox(X(-14), floor - 4, 21, 26, CREAM, RIB_RED, RIB_GREEN, RIB_GREEN, 17);
    gift(X(14), floor, 26, 18, 10, KRAFT, RIB_RED, RIB_GREEN, BOW_CREAM, 18);
    gift(X(44), floor, 56, 26, 14, CREAM, RIB_GREEN, RIB_RED, RIB_RED, 19);
    gift(X(110), floor, 36, 34, 10, KRAFT, RIB_GREEN, RIB_RED, BOW_CREAM, 20);
  }

  // Рендер: палитра → RGB. В сцене поверх — сливовые тени, тёмная комната
  // и тёплый свет свечей ступенями с упорядоченным дизерингом (Байер 4×4),
  // как свет рисуют в пиксель-арте.
  const img = new Uint8ClampedArray(W * H * 4);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const LR = W * 0.13; // радиус света свечи
  const BG = [24, 14, 28];
  const horizon = Math.round(H * 0.8);
  const vpY = horizon - H * 0.3;
  /**
   * Просторная затемнённая комната: обои с узором, деревянные панели,
   * плинтус, высокое окно с лунным светом и шторами, картина в раме,
   * дощатый пол в перспективе и ковёр под ёлкой. Ёлка тепло подсвечивает
   * стену и пол вокруг себя.
   */
  let glass = false;
  const WIN = { x0: Math.round(W * 0.06), x1: Math.round(W * 0.24), y0: Math.round(H * 0.12), y1: Math.round(H * 0.52) };
  const glassMask = new Uint8ClampedArray((WIN.x1 - WIN.x0 + 1) * (WIN.y1 - WIN.y0 + 1) * 4);
  const room = (x: number, y: number): [number, number, number] => {
    let c: [number, number, number];
    glass = false;
    if (y < horizon) {
      // Обои: тёмные сливово-коричневые, вертикальные полосы и ромбики
      c = [44, 28, 40];
      if (x % 18 < 2) c = [50, 32, 45];
      const mx = ((x + 9) % 18) - 9;
      const my = (y % 26) - 13;
      if (Math.abs(mx) + Math.abs(my) === 4) c = [54, 36, 48];
      // Панели снизу стены и плинтус
      const panelTop = horizon - Math.round(H * 0.11);
      if (y >= panelTop) {
        c = [46, 28, 24];
        const px2 = x % 46;
        const py2 = y - panelTop;
        const ph = horizon - panelTop;
        if (py2 < 2) c = [62, 40, 32];
        else if ((px2 === 5 || px2 === 41) && py2 > 6 && py2 < ph - 8) c = [36, 21, 19];
        else if ((py2 === 7 || py2 === ph - 9) && px2 > 5 && px2 < 41) c = [36, 21, 19];
        if (y >= horizon - 5) c = [32, 19, 18];
      }
      // Окно слева: лунный свет, переплёт, шторы, карниз
      const { x0: wx0, x1: wx1, y0: wy0, y1: wy1 } = WIN;
      if (x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1) {
        const t = (y - wy0) / (wy1 - wy0);
        c = [40 + 18 * (1 - t), 42 + 18 * (1 - t), 74 + 22 * (1 - t)];
        const mid = Math.round((wx0 + wx1) / 2);
        if (x <= wx0 + 2 || x >= wx1 - 2 || y <= wy0 + 2 || y >= wy1 - 2) c = [58, 40, 46];
        else if (Math.abs(x - mid) <= 1 || [0.33, 0.66].some((f) => Math.abs(y - (wy0 + (wy1 - wy0) * f)) <= 1)) c = [28, 18, 26];
        else glass = true;
      }
      const curtain = (a: number, b: number) => x >= a && x <= b && y >= wy0 - 8 && y < horizon - 2;
      if (curtain(wx0 - 12, wx0 + 3) || curtain(wx1 - 3, wx1 + 12)) {
        c = x % 5 < 2 ? [52, 16, 24] : [68, 22, 30];
        glass = false;
      }
      if (y >= wy0 - 11 && y <= wy0 - 8 && x >= wx0 - 14 && x <= wx1 + 14) c = [70, 50, 34];
      // Картина справа
      const fx0 = Math.round(W * 0.78);
      const fx1 = Math.round(W * 0.92);
      const fy0 = Math.round(H * 0.24);
      const fy1 = Math.round(H * 0.36);
      if (x >= fx0 && x <= fx1 && y >= fy0 && y <= fy1) {
        const frame = x <= fx0 + 2 || x >= fx1 - 2 || y <= fy0 + 2 || y >= fy1 - 2;
        c = frame ? [96, 72, 40] : y > (fy0 + fy1) / 2 + Math.sin(x * 0.4) * 3 ? [34, 40, 38] : [40, 34, 44];
      }
    } else {
      // Пол: доски в перспективе к точке схода над центром
      const u = (x - cx) / Math.max(1, y - vpY);
      const bu = u * 9;
      const board = Math.floor(bu + 100);
      c = board % 2 ? [56, 34, 26] : [50, 30, 23];
      if (bu - Math.floor(bu) < 0.08) c = [30, 18, 15];
      // Поперечные стыки досок
      const seam = (yy: number) => Math.floor(900 / Math.max(1, yy - vpY) + board * 0.37);
      if (seam(y) !== seam(y + 1)) c = [34, 20, 17];
      // Ковёр под ёлкой
      const rx = (x - cx) / (W * 0.46);
      const ry = (y - (H - 6)) / (H * 0.07);
      const rr = rx * rx + ry * ry;
      if (rr < 1) {
        if (rr > 0.82) c = [92, 60, 34];
        else if (rr > 0.7) c = [70, 20, 26];
        else c = (Math.floor(rx * 12) + Math.floor(ry * 3)) % 2 ? [64, 18, 24] : [74, 24, 30];
      }
      // Дальний пол темнее
      const far = Math.max(0, 1 - (y - horizon) / (H * 0.2));
      c = [c[0] * (1 - far * 0.35), c[1] * (1 - far * 0.35), c[2] * (1 - far * 0.3)];
    }
    // Тёплое пятно от ёлки на стене и полу
    const gl = Math.max(0, 1 - Math.hypot((x - cx) / (W * 0.55), (y - H * 0.55) / (H * 0.45)));
    const g2 = gl * gl;
    return [c[0] + 46 * g2, c[1] + 26 * g2, c[2] + 10 * g2];
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const c = px[i]!;
      let r: number, g: number, b: number;
      if (c === '.') {
        if (!cfg.scene) continue;
        [r, g, b] = room(x, y);
        if (glass) {
          const mi = ((y - WIN.y0) * (WIN.x1 - WIN.x0 + 1) + (x - WIN.x0)) * 4;
          glassMask[mi] = 255; glassMask[mi + 1] = 255; glassMask[mi + 2] = 255; glassMask[mi + 3] = 255;
        }
      } else {
        const h = TREE_PAL[c]!;
        r = parseInt(h.slice(1, 3), 16); g = parseInt(h.slice(3, 5), 16); b = parseInt(h.slice(5, 7), 16);
        if (cfg.scene && !BACK.includes(c)) {
          // Тени уходят в сливовый, как в тёмной комнате
          const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
          const t = Math.max(0, 0.55 - lum) * 0.9;
          r = r * (1 - t) + 46 * t; g = g * (1 - t) + 24 * t; b = b * (1 - t) + 54 * t;
        }
      }
      if (cfg.scene && candles.length && !'&*+=~'.includes(c)) {
        let L = 0;
        for (const cd of candles) {
          const d = Math.hypot(x - cd.x, (y - cd.y) * 1.1);
          if (d < LR) L += (1 - d / LR) ** 2;
        }
        if (L > 0) {
          const q = Math.floor(Math.min(1, L) * 4 + BAYER[(y % 4) * 4 + (x % 4)]! / 16) / 4;
          const k = c === '.' ? q * 0.3 : q * 0.58;
          r += 255 * 0.55 * k; g += 160 * 0.55 * k; b += 70 * 0.55 * k;
        }
      }
      if (c === '.') {
        // Комната к краям уходит ровно в цвет страницы: картинка не читается рамкой
        const e = Math.min(1, Math.min(x, W - 1 - x, y, H - 1 - y) / (W * 0.1));
        const m = e * e * (3 - 2 * e);
        r = BG[0]! + (r - BG[0]!) * m; g = BG[1]! + (g - BG[1]!) * m; b = BG[2]! + (b - BG[2]!) * m;
        // Пиксельная фактура: ступени цвета с дизерингом
        const dth = BAYER[(y % 4) * 4 + (x % 4)]! / 16 - 0.5;
        r = Math.round(r / 5 + dth) * 5; g = Math.round(g / 5 + dth) * 5; b = Math.round(b / 5 + dth) * 5;
      }
      img[i * 4] = r; img[i * 4 + 1] = g; img[i * 4 + 2] = b; img[i * 4 + 3] = 255;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.putImageData(new ImageData(img, W, H), 0, 0);
  let win: OgonekTreeWindow | undefined;
  if (cfg.scene) {
    const mw = WIN.x1 - WIN.x0 + 1;
    const mh = WIN.y1 - WIN.y0 + 1;
    const mc = document.createElement('canvas');
    mc.width = mw;
    mc.height = mh;
    mc.getContext('2d')!.putImageData(new ImageData(glassMask, mw, mh), 0, 0);
    win = { x: WIN.x0 / W, y: WIN.y0 / H, w: mw / W, h: mh / H, pw: mw, ph: mh, mask: mc.toDataURL('image/png') };
  }
  return { url: canvas.toDataURL('image/png'), bulbs, w: W, h: H, window: win };
}
