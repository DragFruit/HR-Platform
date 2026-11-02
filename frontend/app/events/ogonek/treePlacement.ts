/**
 * Куда сажать игрушку на ёлке.
 *
 * Ёлка нарисована ступенчатыми ярусами и кверху сужается, поэтому свободный
 * разброс по горизонтали зависит от высоты: иначе верхние игрушки висят в
 * воздухе рядом с макушкой. Формула одна и та же на клиенте и в демо-сиде —
 * чтобы ёлка выглядела одинаково и у сотрудника, и на показе.
 *
 * Координаты — доли 0..1 от спрайта ёлки (OGONEK_DECOR.tree, 72×96).
 */

/** Ярусы занимают 0.10..0.80 высоты; ниже — ствол и подставка. */
export const OGONEK_TREE_TOP = 0.16;
export const OGONEK_TREE_BOTTOM = 0.78;

/** Половина ширины яруса на высоте y, в долях ширины спрайта. */
export function ogonekTreeSpread(y: number): number {
  const clamped = Math.min(OGONEK_TREE_BOTTOM, Math.max(OGONEK_TREE_TOP, y));
  // Силуэт — треугольник: от узкой макушки к широкому низу, с запасом на поля.
  return 0.06 + (clamped - OGONEK_TREE_TOP) * 0.52;
}

/** Случайное свободное место на ёлке. */
export function ogonekTreeSpot(rand: () => number): { x: number; y: number } {
  const y = OGONEK_TREE_TOP + rand() * (OGONEK_TREE_BOTTOM - OGONEK_TREE_TOP);
  const spread = ogonekTreeSpread(y);
  return { x: 0.5 + (rand() - 0.5) * 2 * spread, y };
}
