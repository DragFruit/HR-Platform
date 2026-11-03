/**
 * Демонстрационное наполнение «Огонька»: игрушки на ёлке, снежинки, рецепты
 * и события ленты. Нужно ровно для показа — пустая ёлка не даёт понять, как
 * экран выглядит в декабре.
 *
 * Два правила, оба важные:
 * 1. На бою демо не существует: гейт по `appEnv`, а не по словам «тест» в
 *    имени (правило no-demo-seed-on-production).
 * 2. Демо не пишется в `server/data/ogonek.json`. Оно подмешивается при
 *    чтении и помечено `demo: true` — значит, не может «протечь» в бой
 *    вместе с файлом данных и его не надо потом вычищать.
 */

import type {
  OgonekFeedItem,
  OgonekRecipe,
  OgonekSnowflake,
  OgonekToy
} from '../../app/events/ogonek/types';
import { OGONEK_TOY_SIZE } from './ogonekStore';
import { OGONEK_FLAKE_Q } from '../../app/events/ogonek/snowflake';
import {
  ogonekTreeSpread,
  OGONEK_TREE_BOTTOM,
  OGONEK_TREE_TOP
} from '../../app/events/ogonek/treePlacement';
import { getDeployAppEnv } from './appEnv';

/** Демо разрешено только вне боя. Снимается `OGONEK_DEMO=0`. */
export function ogonekDemoAllowed(): boolean {
  if (getDeployAppEnv() === 'production') return false;
  return String(process.env.OGONEK_DEMO ?? '1').trim() !== '0';
}

/** Детерминированный генератор: одно и то же демо при каждом запуске. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const DEMO_PEOPLE: { name: string; department: string }[] = [
  { name: 'Юлия', department: 'HR' },
  { name: 'Никита', department: 'Отдел продаж' },
  { name: 'Марина', department: 'Маркетинг' },
  { name: 'Артём', department: 'Разработка' },
  { name: 'Света', department: 'Бухгалтерия' },
  { name: 'Дмитрий', department: 'Отдел продаж' },
  { name: 'Ольга', department: 'HR' },
  { name: 'Павел', department: 'Разработка' },
  { name: 'Катя', department: 'Дизайн' },
  { name: 'Роман', department: 'Отдел продаж' },
  { name: 'Лена', department: 'Маркетинг' },
  { name: 'Игорь', department: 'Техподдержка' },
  { name: 'Аня', department: 'Дизайн' },
  { name: 'Сергей', department: 'Логистика' },
  { name: 'Вера', department: 'Бухгалтерия' },
  { name: 'Костя', department: 'Разработка' },
  { name: 'Наташа', department: 'HR' },
  { name: 'Миша', department: 'Отдел продаж' },
  { name: 'Таня', department: 'Маркетинг' },
  { name: 'Денис', department: 'Техподдержка' },
  { name: 'Галя', department: 'Логистика' },
  { name: 'Вадим', department: 'Разработка' },
  { name: 'Люба', department: 'Дизайн' },
  { name: 'Антон', department: 'Отдел продаж' },
  { name: 'Рита', department: 'HR' },
  { name: 'Гриша', department: 'Логистика' }
];

const DEMO_WISHES = [
  'Чтобы в следующем году было меньше пожаров и больше выходных',
  'Отпуск у моря и чтобы его никто не двигал',
  'Научиться наконец говорить «нет» без чувства вины',
  'Чтобы команда осталась такой же',
  'Съездить к родителям не на два дня, а на неделю',
  'Дочитать те четыре книги с полки',
  'Повышение. И кота',
  'Чтобы планёрки заканчивались вовремя',
  'Здоровья всем, остальное приложится',
  'Выучить испанский хотя бы до меню в кафе',
  'Чтобы следующий декабрь был спокойнее этого',
  'Бегать три раза в неделю. В этот раз правда',
  'Чтобы ремонт закончился',
  'Больше выходных у моря и меньше дедлайнов',
  'Чтобы получилось то, о чём пока не говорю вслух'
];

/** Семейства тонов: база → тень и свет. Те же, что в палитре спеки. */
const TONES: Record<string, { shadow: string; light: string }> = {
  '2': { shadow: '1', light: '3' },
  '5': { shadow: '4', light: '6' },
  '8': { shadow: '7', light: '9' },
  b: { shadow: 'a', light: 'c' },
  e: { shadow: 'd', light: 'f' },
  h: { shadow: 'g', light: 'f' }
};

/**
 * Тот же приём, что у спрайтов в репозитории: свет слева сверху, тень
 * справа снизу, база внутри. Демо-игрушки должны быть из той же серии,
 * что и остальной арт, иначе на ёлке видно, какие нарисованы нами.
 */
function shadeGrid(g: string[][]): string[][] {
  const h = g.length;
  const w = g[0]?.length ?? 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : g[y]![x]!);
  const out = g.map((r) => [...r]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = g[y]![x]!;
      const fam = TONES[base];
      if (!fam) continue;
      const same = (dx: number, dy: number) => at(x + dx, y + dy) === base;
      const lit = !same(-1, 0) || !same(0, -1) || !same(-1, -1);
      const dark = !same(1, 0) || !same(0, 1) || !same(1, 1);
      if (lit && !dark) out[y]![x] = fam.light;
      else if (dark && !lit) out[y]![x] = fam.shadow;
    }
  }
  return out;
}

/** Пиксельная игрушка 16×16: шар, колокольчик, шишка. */
function demoToyPixels(rand: () => number): string[] {
  const size = OGONEK_TOY_SIZE;
  const g: string[][] = Array.from({ length: size }, () => Array(size).fill('.'));
  const body = ['2', 'b', '8', '5', 'h'][Math.floor(rand() * 5)] ?? '2';
  const trim = ['f', 'e', '9', 'f'][Math.floor(rand() * 4)] ?? 'f';
  const shape = Math.floor(rand() * 4);
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < size && y < size) g[y]![x] = c;
  };
  // шапочка и петелька — общие для всех форм
  for (let x = 6; x <= 9; x++) { put(x, 2, '0'); put(x, 3, '8'); }
  put(7, 0, '0'); put(8, 0, '0'); put(6, 1, '0'); put(9, 1, '0');

  if (shape === 0 || shape === 3) {
    // шар
    const cx = 7.5, cy = 9.5, r = 5.6;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r - 0.8) put(x, y, body);
      else if (d <= r + 0.4) put(x, y, '0');
    }
    if (shape === 3) for (let x = 2; x <= 13; x++) { put(x, 8, trim); put(x, 11, trim); }
    else for (let i = 0; i < 4; i++) { put(4 + i * 2, 9, trim); put(5 + i * 2, 11, trim); }
  } else if (shape === 1) {
    // колокольчик
    for (let y = 4; y <= 12; y++) {
      const half = Math.min(6, 1 + (y - 3));
      for (let x = 8 - half; x <= 7 + half; x++) put(x, y, body);
      put(8 - half - 1, y, '0'); put(8 + half, y, '0');
    }
    for (let x = 1; x <= 14; x++) put(x, 13, '0');
    put(7, 14, trim); put(8, 14, trim);
  } else {
    // шишка: плотный ромб с чешуёй — силуэт читается, в отличие от тонкой звезды
    for (let y = 4; y <= 14; y++) {
      const half = 5 - Math.round(Math.abs(y - 9) * 0.55);
      for (let x = 8 - half; x <= 7 + half; x++) put(x, y, body);
      put(7 - half, y, '0'); put(8 + half, y, '0');
    }
    for (let y = 5; y <= 13; y += 2) {
      for (let x = 4; x <= 11; x += 3) put(x + ((y / 2) % 2 ? 1 : 0), y, trim);
    }
  }
  return shadeGrid(g).map((row) => row.join(''));
}

/**
 * Четверть снежинки 5×5 — как её рисует сотрудник в окне 12. Диагональ и
 * нижняя строка всегда закрашены: так снежинка держит форму, а не
 * рассыпается в случайные точки.
 */
export function demoSnowflakeQuarter(seed: number): string[] {
  const rand = rng(seed);
  const q: string[][] = Array.from({ length: OGONEK_FLAKE_Q }, () => Array(OGONEK_FLAKE_Q).fill('.'));
  for (let i = 0; i < OGONEK_FLAKE_Q; i++) {
    q[i]![i] = '1';                       // диагональный луч
    q[OGONEK_FLAKE_Q - 1]![i] = '1';      // горизонтальная ось
    q[i]![OGONEK_FLAKE_Q - 1] = '1';      // вертикальная ось
  }
  // Веточки — редко и только рядом с осями, иначе вместо снежинки квадрат.
  for (let y = 1; y < OGONEK_FLAKE_Q - 1; y++) {
    for (let x = 1; x < OGONEK_FLAKE_Q - 1; x++) {
      if (x !== y && Math.abs(x - y) === 1 && rand() > 0.55) q[y]![x] = '1';
    }
  }
  // Кончики лучей иногда раздваиваются
  if (rand() > 0.5) q[0]![OGONEK_FLAKE_Q - 2] = '1';
  return q.map((r) => r.join(''));
}

let cachedToys: OgonekToy[] | null = null;

/** 26 демо-игрушек, разложенных по ярусам ёлки. */
export function demoToys(): OgonekToy[] {
  if (!ogonekDemoAllowed()) return [];
  if (cachedToys) return cachedToys;
  const rand = rng(20271225);
  const base = Date.parse('2026-12-08T10:12:00+03:00');
  cachedToys = DEMO_PEOPLE.map((person, i) => {
    // Ярусы заполняются сверху вниз, чтобы ёлка выглядела наряженной целиком.
    const y =
      OGONEK_TREE_TOP +
      ((i + 0.5) / DEMO_PEOPLE.length) * (OGONEK_TREE_BOTTOM - OGONEK_TREE_TOP);
    const spread = ogonekTreeSpread(y);
    const x = 0.5 + (rand() - 0.5) * 2 * spread;
    return {
      id: `demo-toy-${i + 1}`,
      userId: -(i + 1),
      name: person.name,
      department: person.department,
      pixels: demoToyPixels(rand),
      wish: DEMO_WISHES[i % DEMO_WISHES.length]!,
      x,
      y,
      createdAt: new Date(base + i * 37 * 60 * 1000).toISOString(),
      demo: true
    };
  });
  return cachedToys;
}

let cachedFlakes: OgonekSnowflake[] | null = null;

export function demoSnowflakes(): OgonekSnowflake[] {
  if (!ogonekDemoAllowed()) return [];
  if (cachedFlakes) return cachedFlakes;
  const base = Date.parse('2026-12-16T10:05:00+03:00');
  cachedFlakes = DEMO_PEOPLE.slice(0, 18).map((person, i) => ({
    id: `demo-flake-${i + 1}`,
    userId: -(i + 1),
    name: person.name,
    pixels: demoSnowflakeQuarter(1000 + i * 17),
    createdAt: new Date(base + i * 41 * 60 * 1000).toISOString(),
    demo: true
  }));
  return cachedFlakes;
}

export function demoRecipes(): (OgonekRecipe & { voters: number[] })[] {
  if (!ogonekDemoAllowed()) return [];
  const base = Date.parse('2026-12-23T10:20:00+03:00');
  const rows: [string, string, string, string, number][] = [
    ['Марина', 'Маркетинг', 'Бабушкин, без изменений', 'Картошка, морковь и яйца варятся накануне и ночуют в холодильнике — это единственный секрет. Колбаса докторская, режется мельче всего остального. Горошек сливать насухо. Майонез добавить утром, не раньше.', 7],
    ['Артём', 'Разработка', 'Оливье с курицей', 'Вместо колбасы — отварное бедро, иначе получается тяжело. Огурцы беру солёные и малосольные пополам. Яблоко не кладу, это ересь.', 4],
    ['Света', 'Бухгалтерия', 'С языком, на праздник', 'Отварной язык вместо колбасы, и это сразу другой салат. Варить два с половиной часа, чистить горячим. Остальное как у всех.', 5],
    ['Игорь', 'Техподдержка', 'Ленивый, за двадцать минут', 'Всё из банок и пакетов, картошка в микроволновке. Да, так тоже можно, и 31-го в семь вечера это спасало не раз.', 2]
  ];
  return rows.map(([name, department, title, text, votes], i) => ({
    id: `demo-recipe-${i + 1}`,
    userId: -(100 + i),
    name,
    department,
    title,
    text,
    votes,
    voters: [],
    createdAt: new Date(base + i * 23 * 60 * 1000).toISOString(),
    demo: true
  }));
}

/** События ленты для показа: без них экран адвента выглядит мёртвым. */
export function demoFeed(now: Date): OgonekFeedItem[] {
  if (!ogonekDemoAllowed()) return [];
  const rows: [OgonekFeedItem['kind'], string | null, string | null, string, number][] = [
    ['toy', 'Юлия', 'HR', 'новая игрушка на ёлке', 4],
    ['snowflake', 'Никита', 'Отдел продаж', 'снежинка улетела в метель', 11],
    ['thanks', null, null, 'кто-то сказал спасибо коллеге', 19],
    ['window', 'Марина', 'Маркетинг', 'окно 12 открыто', 26],
    ['toy', 'Артём', 'Разработка', 'новая игрушка на ёлке', 38],
    ['recipe', 'Света', 'Бухгалтерия', 'рецепт оливье выложен', 52],
    ['thanks', null, null, 'кто-то сказал спасибо коллеге', 64],
    ['snowflake', 'Катя', 'Дизайн', 'снежинка улетела в метель', 77],
    ['letter', 'Павел', 'Разработка', 'письмо себе запечатано', 95],
    ['plug', 'Ольга', 'HR', 'вилка в розетке, декор горит', 118],
    ['toy', 'Денис', 'Техподдержка', 'новая игрушка на ёлке', 140],
    ['window', 'Аня', 'Дизайн', 'окно 11 открыто', 165]
  ];
  return rows.map(([kind, name, department, text, minsAgo], i) => ({
    id: `demo-feed-${i + 1}`,
    kind,
    name,
    department,
    text,
    at: new Date(now.getTime() - minsAgo * 60 * 1000).toISOString()
  }));
}

/** Сколько людей «уже открыли» сегодняшнее окно — для социальной заметности. */
export function demoOpenedToday(): number {
  return ogonekDemoAllowed() ? 23 : 0;
}
