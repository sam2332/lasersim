import type { Vec2 } from '../core/math';
import type { Surface } from '../core/types';

export interface LocalHit {
  t: number;
  point: Vec2;
  normal: Vec2;
}

/** Nearest intersection of a ray with a surface (all in the same frame), with t in (tMin, tMax]. */
export function intersectSurface(o: Vec2, d: Vec2, s: Surface, tMin: number, tMax: number): LocalHit | null {
  const hit = s.kind === 'segment' ? raySegment(o, d, s.a, s.b, tMin, tMax) : rayArc(o, d, s, tMin, tMax);
  if (hit && s.orient && hit.normal.x * s.orient.x + hit.normal.y * s.orient.y < 0) {
    hit.normal = { x: -hit.normal.x, y: -hit.normal.y };
  }
  return hit;
}

function raySegment(o: Vec2, d: Vec2, a: Vec2, b: Vec2, tMin: number, tMax: number): LocalHit | null {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denom = d.x * ey - d.y * ex;
  if (Math.abs(denom) < 1e-12) return null;
  const ax = a.x - o.x;
  const ay = a.y - o.y;
  const t = (ax * ey - ay * ex) / denom;
  if (t <= tMin || t > tMax) return null;
  const u = (ax * d.y - ay * d.x) / denom;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  const len = Math.hypot(ex, ey);
  return { t, point: { x: o.x + d.x * t, y: o.y + d.y * t }, normal: { x: -ey / len, y: ex / len } };
}

function rayArc(
  o: Vec2,
  d: Vec2,
  s: { c: Vec2; r: number; accept?: (p: Vec2) => boolean },
  tMin: number,
  tMax: number,
): LocalHit | null {
  const fx = o.x - s.c.x;
  const fy = o.y - s.c.y;
  const b = fx * d.x + fy * d.y;
  const c = fx * fx + fy * fy - s.r * s.r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [-b - sq, -b + sq]) {
    if (t <= tMin || t > tMax) continue;
    const point = { x: o.x + d.x * t, y: o.y + d.y * t };
    if (s.accept && !s.accept(point)) continue;
    return { t, point, normal: { x: (point.x - s.c.x) / s.r, y: (point.y - s.c.y) / s.r } };
  }
  return null;
}

/** Distance along the ray until it leaves the [0,w]×[0,h] board. */
export function exitBoard(o: Vec2, d: Vec2, w: number, h: number): number {
  let t = Infinity;
  if (d.x > 1e-12) t = Math.min(t, (w - o.x) / d.x);
  else if (d.x < -1e-12) t = Math.min(t, -o.x / d.x);
  if (d.y > 1e-12) t = Math.min(t, (h - o.y) / d.y);
  else if (d.y < -1e-12) t = Math.min(t, -o.y / d.y);
  return Math.max(0, t);
}

/** Closest distance from point p to the segment o→o+d·len (d is a unit vector). */
export function distanceToRay(p: Vec2, o: Vec2, d: Vec2, len: number): number {
  const px = p.x - o.x;
  const py = p.y - o.y;
  const t = Math.max(0, Math.min(len, px * d.x + py * d.y));
  return Math.hypot(px - d.x * t, py - d.y * t);
}
