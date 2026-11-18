/**
 * Геометрия большой ёлки желаний и места для игрушек.
 *
 * Ёлка нарисована на сетке 400×640 (treeArt.ts) и прокручивается вниз на
 * несколько экранов. Координаты игрушек — доли 0..1 этой сетки. Силуэт один
 * на всех: по нему рисуется ёлка, по нему сервер выбирает место игрушке и по
 * нему же клиент поправляет старые координаты, если они вылезли за хвою.
 */

export const OGONEK_TREE_W = 400;
export const OGONEK_TREE_H = 640;

/** Хвоя занимает эту полосу по высоте: выше звезда, ниже ствол и кадка. */
export const OGONEK_TREE_TOP = 0.06;
export const OGONEK_TREE_BOTTOM = 0.85;

/** Игрушка 16×16 в долях сетки: от центра до края. */
const TOY_HALF_X = 8 / OGONEK_TREE_W;

/** Половина ширины хвои на высоте y, в долях ширины сетки. */
export function ogonekTreeHalfWidth(y: number): number {
  const t = Math.min(1, Math.max(0, (y - OGONEK_TREE_TOP) / (OGONEK_TREE_BOTTOM - OGONEK_TREE_TOP)));
  // Пышная: быстро раздаётся от макушки, внизу почти во всю ширину
  return 0.06 + 0.42 * Math.pow(t, 0.7);
}

/** Насколько далеко от оси можно повесить игрушку, чтобы она висела на лапах. */
export function ogonekTreeSpread(y: number): number {
  return Math.max(0, ogonekTreeHalfWidth(y) * 0.84 - TOY_HALF_X);
}

/** Сдвинуть точку внутрь хвои: старые игрушки висели на другой, маленькой ёлке. */
export function ogonekTreeClamp(p: { x: number; y: number }): { x: number; y: number } {
  const y = Math.min(OGONEK_TREE_BOTTOM - 0.02, Math.max(OGONEK_TREE_TOP + 0.04, p.y));
  const spread = ogonekTreeSpread(y);
  return { x: 0.5 + Math.min(spread, Math.max(-spread, p.x - 0.5)), y };
}

/** Случайная точка на хвое; внизу ёлка шире, поэтому и игрушек там больше. */
export function ogonekTreeSpot(rand: () => number): { x: number; y: number } {
  const t = Math.sqrt(rand());
  const y = OGONEK_TREE_TOP + 0.04 + t * (OGONEK_TREE_BOTTOM - OGONEK_TREE_TOP - 0.07);
  const spread = ogonekTreeSpread(y);
  return { x: 0.5 + (rand() * 2 - 1) * spread, y };
}

/**
 * Лучшее из нескольких случайных мест: дальше всего от уже висящих игрушек.
 * Так семьдесят игрушек расходятся по всей ёлке, а не слипаются в кучу.
 */
export function ogonekTreeBestSpot(
  rand: () => number,
  taken: { x: number; y: number }[],
  tries = 28
): { x: number; y: number } {
  let best = ogonekTreeSpot(rand);
  let bestScore = -1;
  for (let i = 0; i < tries; i++) {
    const p = i === 0 ? best : ogonekTreeSpot(rand);
    let near = Infinity;
    for (const q of taken) {
      const d = Math.hypot((p.x - q.x) * OGONEK_TREE_W, (p.y - q.y) * OGONEK_TREE_H);
      if (d < near) near = d;
    }
    if (near > bestScore) {
      bestScore = near;
      best = p;
    }
  }
  return best;
}
