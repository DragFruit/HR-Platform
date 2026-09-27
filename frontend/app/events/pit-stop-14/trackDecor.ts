/** Декор картинговой трассы — расстановка вокруг асфальта (не на нём). */

export type TrackDecorItem = {
  id: string;
  src: string;
  left: number;
  top: number;
  /** ширина в % карты */
  widthPct: number;
  rotate?: number;
  flipX?: boolean;
  z?: number;
};

const P = '/events/pit-stop-14/props';

export const TRACK_DECOR: TrackDecorItem[] = [
  // верх / над стартом
  { id: 'stands-n', src: `${P}/stands.png`, left: 48, top: 8.5, widthPct: 11, rotate: -4, z: 1 },
  { id: 'tires-n1', src: `${P}/tires.png`, left: 22, top: 11, widthPct: 5.5, rotate: 12 },
  { id: 'cone-n1', src: `${P}/cone.png`, left: 58, top: 12, widthPct: 2.8, rotate: -8 },
  { id: 'cone-n2', src: `${P}/cone.png`, left: 61.5, top: 13.5, widthPct: 2.5, rotate: 10 },

  // левый внешний край
  { id: 'tires-w1', src: `${P}/tires.png`, left: 9.5, top: 38, widthPct: 6.2, rotate: -18 },
  { id: 'barrier-w', src: `${P}/barrier.png`, left: 8.5, top: 55, widthPct: 7.5, rotate: 90 },
  { id: 'hay-w', src: `${P}/hay.png`, left: 11, top: 72, widthPct: 7, rotate: 70 },
  { id: 'barrel-w', src: `${P}/barrel.png`, left: 10, top: 22, widthPct: 3.8 },

  // правый край (S)
  { id: 'stands-e', src: `${P}/stands.png`, left: 93, top: 48, widthPct: 9.5, rotate: 90 },
  { id: 'tires-e1', src: `${P}/tires.png`, left: 94, top: 28, widthPct: 5.2, rotate: 25 },
  { id: 'barrier-e', src: `${P}/barrier.png`, left: 94.5, top: 68, widthPct: 8, rotate: -85 },
  { id: 'cone-e1', src: `${P}/cone.png`, left: 90, top: 18, widthPct: 2.6 },
  { id: 'cone-e2', src: `${P}/cone.png`, left: 92, top: 21, widthPct: 2.4, rotate: 15 },
  { id: 'barrel-e', src: `${P}/barrel.png`, left: 91, top: 82, widthPct: 3.5 },

  // низ
  { id: 'hay-s1', src: `${P}/hay.png`, left: 40, top: 96, widthPct: 8, rotate: 2 },
  { id: 'hay-s2', src: `${P}/hay.png`, left: 52, top: 95.5, widthPct: 7.5, rotate: -6, flipX: true },
  { id: 'tires-s', src: `${P}/tires.png`, left: 70, top: 95, widthPct: 5.8, rotate: -12 },
  { id: 'cone-s1', src: `${P}/cone.png`, left: 28, top: 95, widthPct: 2.7 },
  { id: 'cone-s2', src: `${P}/cone.png`, left: 31, top: 96.5, widthPct: 2.4, rotate: -12 },
  { id: 'barrel-s', src: `${P}/barrel.png`, left: 18, top: 94, widthPct: 3.6 },

  // внутренние карманы (остров)
  { id: 'tires-in1', src: `${P}/tires.png`, left: 48, top: 42, widthPct: 4.8, rotate: 40 },
  { id: 'cone-in1', src: `${P}/cone.png`, left: 55, top: 55, widthPct: 2.3 },
  { id: 'hay-in', src: `${P}/hay.png`, left: 38, top: 58, widthPct: 5.5, rotate: -25 },
  { id: 'barrel-in', src: `${P}/barrel.png`, left: 62, top: 40, widthPct: 3.2 },
  { id: 'barrier-in', src: `${P}/barrier.png`, left: 72, top: 52, widthPct: 6.5, rotate: 35 }
];
