/** Маска трассы + стартовая точка для хаба Pit Stop. */

export const TRACK_IMG_SRC = '/events/pit-stop-14/track.png?v=5';
export const TRACK_CAR_SRC = '/events/pit-stop-14/car-top.png?v=2';
export const TRACK_W = 1280;
export const TRACK_H = 720;

/** Перед флагом 01, на верхней горизонтали. % от карты. */
export const TRACK_START = { left: 31.9, top: 25.2, angleDeg: 0 };

/** Линия старта поперёк полотна (вертикаль на горизонтальном участке). */
export const TRACK_START_LINE = { left: 31.9, top: 24.7, widthPct: 6.4, angleDeg: 90 };

const LUM_TRACK_MIN = 55;

export type TrackMask = {
  w: number;
  h: number;
  /** 1 = можно ехать */
  data: Uint8Array;
};

export async function loadTrackMask(src: string = TRACK_IMG_SRC): Promise<TrackMask> {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || TRACK_W;
  canvas.height = img.naturalHeight || TRACK_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const o = i * 4;
    const lum = (data[o] + data[o + 1] + data[o + 2]) / 3;
    mask[i] = lum >= LUM_TRACK_MIN ? 1 : 0;
  }
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

export function isOnTrack(mask: TrackMask, leftPct: number, topPct: number): boolean {
  const x = Math.round((leftPct / 100) * (mask.w - 1));
  const y = Math.round((topPct / 100) * (mask.h - 1));
  if (x < 0 || y < 0 || x >= mask.w || y >= mask.h) return false;
  return mask.data[y * mask.w + x] === 1;
}

/** Несколько точек вокруг центра машинки — не свешиваемся с асфальта. */
export function carFitsOnTrack(mask: TrackMask, leftPct: number, topPct: number, radiusPct = 0.35): boolean {
  const pts = [
    [0, 0],
    [radiusPct, 0],
    [-radiusPct, 0],
    [0, radiusPct],
    [0, -radiusPct],
    [radiusPct * 0.7, radiusPct * 0.7],
    [-radiusPct * 0.7, radiusPct * 0.7],
    [radiusPct * 0.7, -radiusPct * 0.7],
    [-radiusPct * 0.7, -radiusPct * 0.7]
  ];
  return pts.every(([dx, dy]) => isOnTrack(mask, leftPct + dx, topPct + dy));
}

export function clampCarToTrack(
  mask: TrackMask,
  from: { left: number; top: number },
  to: { left: number; top: number }
): { left: number; top: number } {
  if (carFitsOnTrack(mask, to.left, to.top)) return to;
  const xOnly = { left: to.left, top: from.top };
  if (carFitsOnTrack(mask, xOnly.left, xOnly.top)) return xOnly;
  const yOnly = { left: from.left, top: to.top };
  if (carFitsOnTrack(mask, yOnly.left, yOnly.top)) return yOnly;
  return from;
}
