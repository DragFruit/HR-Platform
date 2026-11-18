/**
 * Большая пышная ёлка желаний: рисуется кодом на сетке 220×640 и
 * масштабируется целым множителем. Палитра та же, свет слева сверху.
 *
 * Ярусы перекрывают друг друга: верхний лежит поверх нижнего и бросает на
 * него тень. Низ каждого яруса — провисающие лапы со снегом на кончиках.
 * Огоньки гирлянды отдаются отдельно: они светятся элементами поверх.
 */
import { OGONEK_PALETTE } from './palette';
import { OGONEK_OBJECTS } from './sprites';
import {
  OGONEK_TREE_BOTTOM,
  OGONEK_TREE_H,
  OGONEK_TREE_TOP,
  OGONEK_TREE_W,
  ogonekTreeHalfWidth
} from './treePlacement';

export type OgonekTreeBulb = { x: number; y: number; color: string; delay: number };

const W = OGONEK_TREE_W;
const H = OGONEK_TREE_H;
const TIERS = 13;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const rgb = (key: string) => {
  const h = OGONEK_PALETTE[key]!;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};

let cached: { url: string; bulbs: OgonekTreeBulb[] } | null = null;

export function ogonekTreeImage(): { url: string; bulbs: OgonekTreeBulb[] } {
  if (cached) return cached;
  const rand = rng(20271225);
  const top = Math.round(OGONEK_TREE_TOP * H);
  const bottom = Math.round(OGONEK_TREE_BOTTOM * H);
  const cx = W / 2;

  // Ярус каждой точки: самый верхний, в который она попадает
  const tier = new Int16Array(W * H).fill(-1);
  const edgeY: number[][] = [];
  const tierBox: { y0: number; y1: number }[] = [];
  for (let k = 0; k < TIERS; k++) {
    const y0 = Math.round(top + ((bottom - top) * k) / TIERS - (k ? 14 : 0));
    const y1 = Math.round(top + ((bottom - top) * (k + 1)) / TIERS);
    tierBox.push({ y0, y1 });
    const hw = ogonekTreeHalfWidth(y1 / H) * W;
    const droops = 3 + Math.floor(k * 0.9);
    const depth = 3 + k * 0.45;
    const phase = rand() * Math.PI;
    const edge: number[] = [];
    for (let x = 0; x < W; x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      edge.push(u < 0 || u > 1 ? -1 : y1 + depth * Math.abs(Math.sin(Math.PI * droops * u + phase * 0.15)) - depth);
    }
    edgeY.push(edge);
    for (let y = y0; y <= y1 + depth; y++) {
      const v = (y - y0) / Math.max(1, y1 - y0);
      const half = (ogonekTreeHalfWidth(Math.min(y, y1) / H) * W) * (0.55 + 0.45 * Math.min(1, v));
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if (y > edge[x]!) continue;
        const i = y * W + x;
        if (tier[i] === -1) tier[i] = k;
      }
    }
  }

  const img = new Uint8ClampedArray(W * H * 4);
  const paint = (x: number, y: number, key: string) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const [r, g, b] = rgb(key);
    const o = (y * W + x) * 4;
    img[o] = r!; img[o + 1] = g!; img[o + 2] = b!; img[o + 3] = 255;
  };
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : tier[y * W + x]!);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = at(x, y);
      if (k < 0) continue;
      const box = tierBox[k]!;
      const half = ogonekTreeHalfWidth(y / H) * W;
      const dx = (x - cx) / Math.max(1, half);
      const v = (y - box.y0) / Math.max(1, box.y1 - box.y0);
      // Контур силуэта
      if (at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y + 1) < 0) { paint(x, y, '0'); continue; }
      // Кромка лапы поверх нижнего яруса
      if (at(x, y + 1) > k) { paint(x, y, '4'); continue; }
      // Тень, которую верхний ярус бросает на этот
      if (at(x, y - 1) < k || at(x, y - 2) < k || at(x, y - 3) < k) { paint(x, y, '4'); continue; }
      let key = '5';
      if (dx < -0.3 && v < 0.85) key = '6';
      if (dx > 0.45 || v > 0.92) key = '4';
      // Иголки: короткие косые штрихи светом и тенью
      const n = (x * 7 + y * 13 + ((x * y) % 5)) % 23;
      if (n === 0) key = dx < 0.2 ? '6' : '4';
      if (n === 11 && key === '6') key = '5';
      paint(x, y, key);
    }
  }

  // Снег на кончиках лап
  for (let k = 0; k < TIERS; k++) {
    const edge = edgeY[k]!;
    for (let x = 2; x < W - 2; x++) {
      const e = edge[x]!;
      if (e < 0) continue;
      const isTip = e >= edge[x - 1]! && e >= edge[x + 1]! && e > edge[x - 2]! && e > edge[x + 2]!;
      if (!isTip || at(x, Math.round(e)) !== k) continue;
      const y = Math.round(e) - 1;
      for (let dx = -3; dx <= 3; dx++) {
        const h = 2 - Math.abs(dx) * 0.5;
        for (let dy = 0; dy < h; dy++) paint(x + dx, y - dy, dy === 0 ? 'e' : 'f');
      }
      paint(x - 4, y, 'd');
      paint(x + 4, y, 'd');
    }
  }

  // Ствол, кадка и подарки под ёлкой
  const trunkTop = bottom - 4;
  for (let y = trunkTop; y < trunkTop + 30; y++) {
    for (let x = cx - 10; x <= cx + 10; x++) {
      if (at(x, y) >= 0) continue;
      const edge = x === cx - 10 || x === cx + 10;
      paint(x, y, edge ? '0' : x < cx - 4 ? '8' : x > cx + 5 ? '1' : '7');
    }
  }
  const potTop = trunkTop + 26;
  for (let y = potTop; y < potTop + 30; y++) {
    const v = (y - potTop) / 30;
    const half = 34 - v * 8;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const edge = Math.abs(x - cx) > half - 1 || y === potTop || y === potTop + 29;
      let key = x < cx - half * 0.4 ? '3' : x > cx + half * 0.5 ? '1' : '2';
      if (y >= potTop + 8 && y <= potTop + 12) key = x < cx ? '9' : '8';
      paint(x, y, edge ? '0' : key);
    }
  }
  const gift = OGONEK_OBJECTS.gift;
  for (const [ox, oy] of [[cx - 92, potTop - 4], [cx + 52, potTop - 2], [cx - 60, potTop + 2]] as const) {
    gift.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') paint(ox + x, oy + y, c); }));
  }

  // Звезда на макушке
  const sx = cx;
  const sy = top - 10;
  for (let y = -14; y <= 14; y++) {
    for (let x = -14; x <= 14; x++) {
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x) + Math.PI / 2;
      const spike = 6 + 8 * Math.pow(Math.abs(Math.cos((a * 5) / 2)), 3);
      if (r > spike) continue;
      const key = r > spike - 1.2 ? '0' : x + y < -3 ? '9' : x + y > 4 ? '7' : '8';
      paint(Math.round(sx + x), Math.round(sy + y), key);
    }
  }

  // Гирлянды: провисающие нити огоньков через несколько ярусов
  const bulbs: OgonekTreeBulb[] = [];
  const colors = ['2', 'b', '8', 'h', 'f'];
  for (let k = 1; k < TIERS; k += 2) {
    const box = tierBox[k]!;
    const y = box.y0 + (box.y1 - box.y0) * 0.55;
    const half = ogonekTreeHalfWidth(y / H) * W * 0.86;
    const n = 4 + Math.floor(k * 0.8);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const x = cx - half + 2 * half * u;
      const yy = y + 9 * Math.sin(Math.PI * u) - (k % 4 === 1 ? 4 : -2) * (u - 0.5);
      const key = colors[(i + k) % colors.length]!;
      paint(Math.round(x), Math.round(yy), key);
      paint(Math.round(x), Math.round(yy) + 1, key);
      paint(Math.round(x) + 1, Math.round(yy), '0');
      bulbs.push({ x: x / W, y: yy / H, color: OGONEK_PALETTE[key]!, delay: -((i * 0.7 + k * 0.4) % 5) });
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.putImageData(new ImageData(img, W, H), 0, 0);
  cached = { url: canvas.toDataURL('image/png'), bulbs };
  return cached;
}
