/**
 * Ленивая загрузка @hiseb/confetti с запасным цветом.
 *
 * Библиотека красит частицы в canvas через `oklch(...)`. Старый Safari (iOS < 16.4)
 * не понимает oklch в canvas: fillStyle молча остаётся #000000 — конфетти чёрные.
 * Если canvas не принимает oklch, подменяем такие строки на hsl того же оттенка.
 * Там, где oklch работает (десктоп, свежий iOS), ничего не меняется.
 */

type ConfettiOptions = {
  position: { x: number; y: number };
  count: number;
  velocity: number;
};

export type ConfettiFn = (options: ConfettiOptions) => void;

let fallbackChecked = false;

const OKLCH_RE = /^oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i;

export function oklchToHslFallback(value: string): string | null {
  const m = OKLCH_RE.exec(value.trim());
  if (!m) return null;
  const hue = Math.round(Number(m[1]) % 360);
  let alpha = m[2] === undefined ? 1 : Number(m[2]);
  if (m[3] === '%') alpha /= 100;
  return `hsla(${hue}, 92%, 62%, ${Math.max(0, Math.min(1, alpha))})`;
}

function ensureCanvasOklchFallback() {
  if (fallbackChecked || typeof document === 'undefined') return;
  fallbackChecked = true;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#000000';
  ctx.fillStyle = 'oklch(0.85 0.25 120deg / 100%)';
  if (ctx.fillStyle !== '#000000') return; // oklch поддерживается

  const proto = CanvasRenderingContext2D.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'fillStyle');
  if (!desc?.set || !desc.get) return;
  const nativeSet = desc.set;
  Object.defineProperty(proto, 'fillStyle', {
    configurable: true,
    enumerable: desc.enumerable,
    get: desc.get,
    set(this: CanvasRenderingContext2D, v: unknown) {
      const next = typeof v === 'string' && v.startsWith('oklch(') ? (oklchToHslFallback(v) ?? v) : v;
      nativeSet.call(this, next);
    }
  });
}

let cached: ConfettiFn | null = null;

export async function importConfetti(): Promise<ConfettiFn | null> {
  if (!import.meta.client) return null;
  if (!cached) {
    ensureCanvasOklchFallback();
    const mod = await import('@hiseb/confetti');
    cached = mod.default as ConfettiFn;
  }
  return cached;
}
