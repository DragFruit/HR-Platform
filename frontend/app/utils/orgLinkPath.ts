export type OrgPortSide = 'top' | 'right' | 'bottom' | 'left';

export type Point = { x: number; y: number };

export type Rect = { left: number; top: number; width: number; height: number };

const SIDE_OUT: Record<OrgPortSide, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
};

const STUB = 16;

export const ORG_PORT_SIDES: OrgPortSide[] = ['top', 'right', 'bottom', 'left'];

export function anchorPoint(rect: Rect, side: OrgPortSide): Point {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  switch (side) {
    case 'top':
      return { x: cx, y: rect.top };
    case 'bottom':
      return { x: cx, y: rect.bottom };
    case 'left':
      return { x: rect.left, y: cy };
    case 'right':
      return { x: rect.left + rect.width, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

function isVerticalSide(side: OrgPortSide) {
  return side === 'top' || side === 'bottom';
}

function routeMid(a: Point, b: Point, fromSide: OrgPortSide, toSide: OrgPortSide): Point[] {
  if (isVerticalSide(fromSide) && isVerticalSide(toSide)) {
    const midY = (a.y + b.y) / 2;
    if (Math.abs(a.x - b.x) < 1) return [{ x: a.x, y: midY }];
    return [
      { x: a.x, y: midY },
      { x: b.x, y: midY }
    ];
  }
  if (!isVerticalSide(fromSide) && !isVerticalSide(toSide)) {
    const midX = (a.x + b.x) / 2;
    if (Math.abs(a.y - b.y) < 1) return [{ x: midX, y: a.y }];
    return [
      { x: midX, y: a.y },
      { x: midX, y: b.y }
    ];
  }
  if (isVerticalSide(fromSide)) {
    return [{ x: b.x, y: a.y }];
  }
  return [{ x: a.x, y: b.y }];
}

export function linkPolylinePoints(
  from: Point & { side: OrgPortSide },
  to: Point & { side: OrgPortSide }
): Point[] {
  const p0 = { x: from.x, y: from.y };
  const p1 = {
    x: p0.x + SIDE_OUT[from.side].x * STUB,
    y: p0.y + SIDE_OUT[from.side].y * STUB
  };
  const p4 = { x: to.x, y: to.y };
  const p3 = {
    x: p4.x + SIDE_OUT[to.side].x * STUB,
    y: p4.y + SIDE_OUT[to.side].y * STUB
  };
  const mid = routeMid(p1, p3, from.side, to.side);
  return [p0, p1, ...mid, p3, p4];
}

export function pointsToPolyline(points: Point[]): string {
  const valid = points.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length) return '';
  return valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

const CORNER_RADIUS = 10;

function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function roundedPolylinePath(points: Point[], radius = CORNER_RADIUS): string {
  if (points.length < 2) return '';
  if (points.length === 2) return pointsToPolyline(points);

  const parts: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    if (!prev || !curr || !next) continue;

    const inLen = dist(prev, curr);
    const outLen = dist(curr, next);
    if (inLen < 0.5 || outLen < 0.5) continue;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 0.5) {
      parts.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
      continue;
    }

    const inPt = lerp(curr, prev, r / inLen);
    const outPt = lerp(curr, next, r / outLen);
    const sweep = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x) > 0 ? 1 : 0;

    parts.push(`L ${inPt.x.toFixed(1)} ${inPt.y.toFixed(1)}`);
    parts.push(`A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 ${sweep} ${outPt.x.toFixed(1)} ${outPt.y.toFixed(1)}`);
  }

  const last = points[points.length - 1];
  if (!last) return parts.join(' ');
  parts.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return parts.join(' ');
}

export function linkPathD(
  from: Point & { side: OrgPortSide },
  to: Point & { side: OrgPortSide }
): string {
  return roundedPolylinePath(linkPolylinePoints(from, to));
}
