/** Гоночная трасса хаба Pit Stop: арт, маска полотна, старт, зоны круга, цвета болида. */

export const TRACK_IMG_SRC = '/events/pit-stop-14/track-race.jpg?v=1';
export const TRACK_MASK_SRC = '/events/pit-stop-14/track-race-mask.png?v=1';
export const TRACK_W = 1280;
export const TRACK_H = 720;

/** Габарит болида в px трассы (1280×720). */
export const CAR_LEN = 40;
export const CAR_WIDTH = 19;
/** Картинка чуть крупнее коллизии — колёса и антикрыло визуально свешиваются. */
export const CAR_SPRITE_SCALE = 1.2;

/** Спавн за линией старта, носом на восток. Угол: 0 = север, по часовой. */
export const TRACK_SPAWN = { x: 255, y: 185, angleDeg: 90 };

/** Линия старт/финиш: вертикаль x = LINE_X на верхней прямой, круг — пересечение на восток. */
export const START_LINE = { x: 287, yMin: 140, yMax: 220 };

/** Обязательные зоны круга (порядок не важен), радиус в px трассы. */
export const LAP_ZONES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 625, y: 300 },
  { x: 1075, y: 375 },
  { x: 750, y: 588 },
  { x: 338, y: 450 },
  { x: 188, y: 375 }
];
export const LAP_ZONE_R = 70;

/** Заезд — один круг; поздравление только если улучшили рекорд. */
export const RACE_LAPS = 1;

/** Совпадает с серверной проверкой: быстрее — круг не принимается. */
export const MIN_LAP_MS = 8000;
export const MAX_LAP_MS = 10 * 60 * 1000;

export const CAR_COLORS = [
  { id: 'violet', label: 'Фиолетовый', swatch: '#7451f4' },
  { id: 'red', label: 'Красный', swatch: '#e0312b' },
  { id: 'blue', label: 'Синий', swatch: '#2f6fe0' },
  { id: 'orange', label: 'Оранжевый', swatch: '#ff8a1f' },
  { id: 'teal', label: 'Бирюзовый', swatch: '#2fd6b4' },
  { id: 'pink', label: 'Розовый', swatch: '#ff4fa3' },
  { id: 'graphite', label: 'Графит', swatch: '#6b6b70' }
] as const;

export type CarColorId = (typeof CAR_COLORS)[number]['id'];

export const CAR_COLOR_STORAGE_KEY = 'vbi-pit-stop-car-color-v1';

export const isCarColorId = (v: unknown): v is CarColorId =>
  typeof v === 'string' && CAR_COLORS.some((c) => c.id === v);

export const carSrc = (color: CarColorId) => `/events/pit-stop-14/cars/${color}.png?v=1`;

export function formatLapMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—:——.———';
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const r = total % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

export type TrackMask = {
  w: number;
  h: number;
  /** 1 = асфальт */
  data: Uint8Array;
};

export async function loadTrackMask(src: string = TRACK_MASK_SRC): Promise<TrackMask> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || TRACK_W;
  canvas.height = img.naturalHeight || TRACK_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4] > 127 ? 1 : 0;
  return { w: width, h: height, data: mask };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`track img ${src}`));
    img.src = src;
  });
}

export function isOnTrack(mask: TrackMask, x: number, y: number): boolean {
  const px = Math.round((x / TRACK_W) * mask.w);
  const py = Math.round((y / TRACK_H) * mask.h);
  if (px < 0 || py < 0 || px >= mask.w || py >= mask.h) return false;
  return mask.data[py * mask.w + px] === 1;
}

/** Углы и нос повёрнутого прямоугольника болида — все на асфальте. */
export function carFitsOnTrack(mask: TrackMask, x: number, y: number, angleDeg: number): boolean {
  const a = (angleDeg * Math.PI) / 180;
  const fx = Math.sin(a);
  const fy = -Math.cos(a);
  const rx = Math.cos(a);
  const ry = Math.sin(a);
  const hl = CAR_LEN / 2 - 3;
  const hw = CAR_WIDTH / 2 - 2;
  const pts: Array<[number, number]> = [
    [hl, 0],
    [hl, hw],
    [hl, -hw],
    [-hl, hw],
    [-hl, -hw],
    [0, hw],
    [0, -hw]
  ];
  return pts.every(([f, r]) => isOnTrack(mask, x + fx * f + rx * r, y + fy * f + ry * r));
}
