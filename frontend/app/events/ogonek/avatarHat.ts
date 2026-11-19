/**
 * Новогодний колпак для аватарок персонажей (окно 3). Отдельный рисунок, а
 * не иконка окна: на голове колпак должен мягко загибаться вбок, а помпон
 * свисать, иначе он торчит рожком.
 *
 * Свет слева сверху, как у всей серии: левая кромка светлее, правая в тени.
 */

const W = 34;
const H = 26;

export const OGONEK_AVATAR_HAT: string[] = (() => {
  const g = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) g[y]![x] = c;
  };

  // Конус: поднимается от меха и загибается вправо, к помпону
  const BASE_Y = 19;
  const spine = (t: number) => ({
    x: 13 + 14 * Math.pow(t, 1.3),
    y: BASE_Y - 40 * t + 28 * t * t
  });
  for (let i = 0; i <= 500; i++) {
    const t = i / 500;
    const { x, y } = spine(t);
    const half = 10 * Math.pow(1 - t, 0.9) + 1.4;
    for (let dx = -half; dx <= half; dx += 0.5) {
      const px = Math.round(x + dx);
      const py = Math.round(y);
      const edge = Math.abs(dx) > half - 1.1;
      let c = '2';
      if (dx < -half * 0.4) c = '3';
      else if (dx > half * 0.4) c = '1';
      if (!edge || g[py]?.[px] === '.') put(px, py, edge ? '0' : c);
    }
  }
  // Складка ткани
  for (let i = 0; i < 5; i++) put(15 + i, 15 - i, '1');

  // Помпон на кончике
  const cx = 28;
  const cy = 9;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 4.4) continue;
      if (d > 3.5) put(x, y, '0');
      else if (x + y < cx + cy - 2) put(x, y, 'f');
      else if (x + y > cx + cy + 2) put(x, y, 'd');
      else put(x, y, 'e');
    }
  }

  // Меховой отворот: по ширине основания конуса, пушистые кромки
  const LEFT = 1;
  const RIGHT = 26;
  for (let x = LEFT; x <= RIGHT; x++) {
    const top = BASE_Y - (x % 4 === 1 ? 1 : 0);
    const bottom = BASE_Y + 4 + (x % 5 === 2 ? 1 : 0);
    for (let y = top; y <= bottom; y++) {
      let c = 'e';
      if (y === top) c = 'f';
      if (y >= bottom - 1) c = 'd';
      if (x <= LEFT + 2 && y < bottom - 1) c = 'f';
      if (x >= RIGHT - 2 && y > top) c = 'd';
      put(x, y, c);
    }
    put(x, top - 1, '0');
    put(x, bottom + 1, '0');
  }
  for (let y = BASE_Y - 1; y <= BASE_Y + 5; y++) {
    put(LEFT - 1, y, '0');
    put(RIGHT + 1, y, '0');
  }
  for (const [x, y] of [[6, 21], [12, 22], [18, 21], [23, 22], [9, 23], [16, 23]] as const) put(x, y, 'd');

  return g.map((r) => r.join(''));
})();
