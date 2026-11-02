/**
 * Отрисовка пиксельных спрайтов «Огонька» в картинку.
 *
 * Спрайт — сетка символов палитры. Рисуем его на canvas один к одному
 * (один пиксель сетки = один пиксель картинки) и отдаём data-URL, который
 * дальше масштабируется средствами CSS с `image-rendering: pixelated`.
 * Так браузер не раздувает DOM тысячами div-ов и картинка остаётся чёткой
 * на любом размере.
 *
 * Кэш по ссылке на сетку: один и тот же спрайт рисуется один раз за заход.
 */

import { ogonekColorAt } from '~/events/ogonek/palette';

const cache = new WeakMap<object, string>();
const stringCache = new Map<string, string>();

function paint(rows: readonly string[]): string {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (!w || !h) return '';
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const color = ogonekColorAt(row[x] ?? '.');
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL('image/png');
}

/** data-URL спрайта. На сервере возвращает пустую строку — рисуем на клиенте. */
export function ogonekSpriteUrl(rows: readonly string[] | null | undefined): string {
  if (!rows || !rows.length || !import.meta.client) return '';
  const key = rows as unknown as object;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = paint(rows);
  cache.set(key, url);
  return url;
}

/** То же для сеток, которые приходят с сервера новыми массивами каждый раз. */
export function ogonekSpriteUrlByValue(rows: readonly string[] | null | undefined): string {
  if (!rows || !rows.length || !import.meta.client) return '';
  const key = rows.join('|');
  const hit = stringCache.get(key);
  if (hit) return hit;
  const url = paint(rows);
  stringCache.set(key, url);
  return url;
}

export function ogonekSpriteSize(rows: readonly string[] | null | undefined) {
  return { w: rows?.[0]?.length ?? 0, h: rows?.length ?? 0 };
}
