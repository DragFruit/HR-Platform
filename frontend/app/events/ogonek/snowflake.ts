/**
 * Снежинка рисуется четвертью 5×5, остальное отражается само в 9×9.
 * Четверть — то, что хранится и приходит с сервера; полный рисунок
 * собирается на лету и на клиенте, и на сервере (для снегопада платформы).
 */

export const OGONEK_FLAKE_Q = 5;
export const OGONEK_FLAKE_FULL = OGONEK_FLAKE_Q * 2 - 1;

/** Снежинка ивента: такие летят, пока своих ещё мало. */
export const OGONEK_BASE_FLAKE = ['1...1', '.1..1', '..1.1', '...11', '11111'];

/** Четверть: ровно 5 строк по 5 символов `1` или `.`, хотя бы одна клетка. */
export function isOgonekFlakeQuarter(raw: unknown): raw is string[] {
  if (!Array.isArray(raw) || raw.length !== OGONEK_FLAKE_Q) return false;
  if (!raw.every((r) => typeof r === 'string' && /^[1.]{5}$/.test(r))) return false;
  return raw.join('').includes('1');
}

/** Четверть → полный рисунок 9×9 из `1` и `.`. */
export function mirrorOgonekFlake(q: readonly string[]): string[] {
  const rows: string[] = [];
  for (let y = 0; y < OGONEK_FLAKE_FULL; y++) {
    const sy = y < OGONEK_FLAKE_Q ? y : OGONEK_FLAKE_FULL - 1 - y;
    let r = '';
    for (let x = 0; x < OGONEK_FLAKE_FULL; x++) {
      const sx = x < OGONEK_FLAKE_Q ? x : OGONEK_FLAKE_FULL - 1 - x;
      r += q[sy]?.[sx] === '1' ? '1' : '.';
    }
    rows.push(r);
  }
  return rows;
}

/** Полный рисунок в сетку палитры: бумага — кремовый свет. */
export function ogonekFlakeSprite(q: readonly string[]): string[] {
  return mirrorOgonekFlake(q).map((r) => r.replace(/1/g, 'f'));
}
