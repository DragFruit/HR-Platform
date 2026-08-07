export type OrgPortSide = 'top' | 'right' | 'bottom' | 'left';

export type Point = { x: number; y: number };

export type Rect = { left: number; top: number; width: number; height: number };

export type LinkRouteOpts = {
  /** Смещение средней ортогональной секции (midY или midX в px). */
  mid?: number;
};

const SIDE_OUT: Record<OrgPortSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};

/** Отступ от порта до первого локтя — достаточно для скругления. */
const STUB = 28;

/**
 * Почти вертикальная связь (bottom→top): если порты чуть разъехались по X
 * (типично после compressX при разной ширине нод) — рисуем прямую, без полки-зигзага.
 */
const VERTICAL_X_SNAP_PX = 56;

/** Не ставить кружок-стык ближе этого расстояния к порту. */
const JUNCTION_PORT_CLEARANCE = 22;

export const ORG_PORT_SIDES: OrgPortSide[] = ['top', 'right', 'bottom', 'left'];

export function anchorPoint(rect: Rect, side: OrgPortSide): Point {
  const left = rect.left;
  const top = rect.top;
  const width = rect.width;
  const height = rect.height;
  const cx = left + width / 2;
  const cy = top + height / 2;
  switch (side) {
    case 'top':
      return { x: cx, y: top };
    case 'bottom':
      return { x: cx, y: top + height };
    case 'left':
      return { x: left, y: cy };
    case 'right':
      return { x: left + width, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

function isVerticalSide(side: OrgPortSide) {
  return side === 'top' || side === 'bottom';
}

/**
 * Средняя секция всегда ортогональна: двигается целиком (полка).
 * mid не зажимаем между stubs — полку можно увести выше/ниже портов (общая шина).
 */
function routeMid(
  a: Point,
  b: Point,
  fromSide: OrgPortSide,
  toSide: OrgPortSide,
  mid?: number
): Point[] {
  // Вертикальный выход → горизонтальная полка на midY
  if (isVerticalSide(fromSide) && isVerticalSide(toSide)) {
    const midY = mid != null && Number.isFinite(mid) ? mid : (a.y + b.y) / 2;
    if (Math.abs(a.x - b.x) < 1) return [{ x: a.x, y: midY }];
    return [
      { x: a.x, y: midY },
      { x: b.x, y: midY }
    ];
  }

  // Горизонтальный выход → вертикальная полка на midX
  if (!isVerticalSide(fromSide) && !isVerticalSide(toSide)) {
    const midX = mid != null && Number.isFinite(mid) ? mid : (a.x + b.x) / 2;
    if (Math.abs(a.y - b.y) < 1) return [{ x: midX, y: a.y }];
    return [
      { x: midX, y: a.y },
      { x: midX, y: b.y }
    ];
  }

  // Смешанные стороны: тоже полка (не одиночный угол)
  if (isVerticalSide(fromSide)) {
    const midY = mid != null && Number.isFinite(mid) ? mid : a.y;
    if (Math.abs(midY - a.y) < 1 && Math.abs(a.x - b.x) >= 1) {
      return [{ x: b.x, y: a.y }];
    }
    if (Math.abs(a.x - b.x) < 1) return [{ x: a.x, y: midY }];
    return [
      { x: a.x, y: midY },
      { x: b.x, y: midY }
    ];
  }

  const midX = mid != null && Number.isFinite(mid) ? mid : a.x;
  if (Math.abs(midX - a.x) < 1 && Math.abs(a.y - b.y) >= 1) {
    return [{ x: a.x, y: b.y }];
  }
  if (Math.abs(a.y - b.y) < 1) return [{ x: midX, y: a.y }];
  return [
    { x: midX, y: a.y },
    { x: midX, y: b.y }
  ];
}

/** Убрать дубликаты и точки на прямых (без смены направления). */
export function simplifyOrthogonalPoints(points: Point[]): Point[] {
  const raw = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (raw.length <= 2) return raw.map((p) => ({ x: p.x, y: p.y }));

  const dedup: Point[] = [{ x: raw[0]!.x, y: raw[0]!.y }];
  for (let i = 1; i < raw.length; i += 1) {
    const prev = dedup[dedup.length - 1]!;
    const cur = raw[i]!;
    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) < 0.75) continue;
    dedup.push({ x: cur.x, y: cur.y });
  }
  if (dedup.length <= 2) return dedup;

  const out: Point[] = [dedup[0]!];
  for (let i = 1; i < dedup.length - 1; i += 1) {
    const a = out[out.length - 1]!;
    const b = dedup[i]!;
    const c = dedup[i + 1]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.5) continue;
    out.push(b);
  }
  out.push(dedup[dedup.length - 1]!);
  return out;
}

export function linkPolylinePoints(
  from: Point & { side: OrgPortSide },
  to: Point & { side: OrgPortSide },
  opts?: LinkRouteOpts
): Point[] {
  const fromSide = from.side in SIDE_OUT ? from.side : 'bottom';
  const toSide = to.side in SIDE_OUT ? to.side : 'top';
  const fromDir = SIDE_OUT[fromSide];
  const toDir = SIDE_OUT[toSide];

  let fromX = from.x;
  let toX = to.x;
  let fromY = from.y;
  let toY = to.y;

  // Выпрямляем почти вертикальные линии (директор → отдел под ним).
  if (isVerticalSide(fromSide) && isVerticalSide(toSide) && Math.abs(from.x - to.x) <= VERTICAL_X_SNAP_PX) {
    fromX = from.x;
    toX = from.x;
  } else if (
    !isVerticalSide(fromSide) &&
    !isVerticalSide(toSide) &&
    Math.abs(from.y - to.y) <= VERTICAL_X_SNAP_PX
  ) {
    fromY = from.y;
    toY = from.y;
  }

  const p0 = { x: fromX, y: fromY };
  const p1 = {
    x: p0.x + fromDir.x * STUB,
    y: p0.y + fromDir.y * STUB
  };
  const p4 = { x: toX, y: toY };
  const p3 = {
    x: p4.x + toDir.x * STUB,
    y: p4.y + toDir.y * STUB
  };
  const mid = routeMid(p1, p3, fromSide, toSide, opts?.mid);
  return simplifyOrthogonalPoints([p0, p1, ...mid, p3, p4]);
}

export function pointsToPolyline(points: Point[]): string {
  const valid = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length) return '';
  return valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

const CORNER_RADIUS = 12;

function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function roundedPolylinePath(points: Point[], radius = CORNER_RADIUS): string {
  const pts = simplifyOrthogonalPoints(points);
  if (pts.length < 2) return '';
  if (pts.length === 2) return pointsToPolyline(pts);

  const parts: string[] = [`M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`];

  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1]!;
    const curr = pts[i]!;
    const next = pts[i + 1]!;

    const inLen = dist(prev, curr);
    const outLen = dist(curr, next);
    if (inLen < 0.5 || outLen < 0.5) {
      parts.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
      continue;
    }

    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 1) {
      parts.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
      continue;
    }

    const inPt = lerp(curr, prev, r / inLen);
    const outPt = lerp(curr, next, r / outLen);
    const sweep =
      (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x) > 0 ? 1 : 0;

    parts.push(`L ${inPt.x.toFixed(1)} ${inPt.y.toFixed(1)}`);
    parts.push(
      `A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${outPt.x.toFixed(1)} ${outPt.y.toFixed(1)}`
    );
  }

  const last = pts[pts.length - 1]!;
  parts.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return parts.join(' ');
}

export function linkPathD(
  from: Point & { side: OrgPortSide },
  to: Point & { side: OrgPortSide },
  opts?: LinkRouteOpts
): string {
  return roundedPolylinePath(linkPolylinePoints(from, to, opts));
}

/**
 * Локти со сменой направления (не на прямой), далеко от портов —
 * для кружков на развилках. На прямой линии — пусто.
 */
export function linkElbowPoints(
  from: Point & { side: OrgPortSide },
  to: Point & { side: OrgPortSide },
  opts?: LinkRouteOpts
): Point[] {
  const pts = linkPolylinePoints(from, to, opts);
  if (pts.length < 3) return [];
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const corners: Point[] = [];
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1]!;
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (Math.abs(cross) < 0.5) continue;
    if (dist(curr, start) < JUNCTION_PORT_CLEARANCE) continue;
    if (dist(curr, end) < JUNCTION_PORT_CLEARANCE) continue;
    corners.push(curr);
  }
  return corners;
}

/** Ручка для регулировки mid: центр средней полки + ось перетаскивания. */
export function linkMidHandle(
  from: Point & { side: OrgPortSide },
  to: Point & { side: OrgPortSide },
  opts?: LinkRouteOpts
): { x: number; y: number; axis: 'x' | 'y' } | null {
  const fromSide = from.side in SIDE_OUT ? from.side : 'bottom';
  const toSide = to.side in SIDE_OUT ? to.side : 'top';
  const fromStub = {
    x: from.x + SIDE_OUT[fromSide].x * STUB,
    y: from.y + SIDE_OUT[fromSide].y * STUB
  };
  const toStub = {
    x: to.x + SIDE_OUT[toSide].x * STUB,
    y: to.y + SIDE_OUT[toSide].y * STUB
  };

  if (isVerticalSide(fromSide) && isVerticalSide(toSide)) {
    const midY =
      opts?.mid != null && Number.isFinite(opts.mid) ? opts.mid : (fromStub.y + toStub.y) / 2;
    return { x: (from.x + to.x) / 2, y: midY, axis: 'y' };
  }
  if (!isVerticalSide(fromSide) && !isVerticalSide(toSide)) {
    const midX =
      opts?.mid != null && Number.isFinite(opts.mid) ? opts.mid : (fromStub.x + toStub.x) / 2;
    return { x: midX, y: (from.y + to.y) / 2, axis: 'x' };
  }

  if (isVerticalSide(fromSide)) {
    const midY = opts?.mid != null && Number.isFinite(opts.mid) ? opts.mid : fromStub.y;
    return { x: (fromStub.x + toStub.x) / 2, y: midY, axis: 'y' };
  }
  const midX = opts?.mid != null && Number.isFinite(opts.mid) ? opts.mid : fromStub.x;
  return { x: midX, y: (fromStub.y + toStub.y) / 2, axis: 'x' };
}

export function junctionKey(p: Point, precision = 1): string {
  const f = 10 ** precision;
  return `${Math.round(p.x * f) / f},${Math.round(p.y * f) / f}`;
}
