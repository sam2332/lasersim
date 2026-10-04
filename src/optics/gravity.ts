import type { Vec2 } from '../core/math';

export interface WorldField {
  x: number;
  y: number;
  /** Bending strength (length units: pull magnitude = k / r²). */
  k: number;
  horizon: number;
  /** Beyond roughly this distance the pull fades out. */
  reach: number;
}

export function makeWorldField(x: number, y: number, strength: number, horizon: number): WorldField {
  return { x, y, k: strength * horizon * 1.8, horizon, reach: horizon * (10 + 4 * strength) };
}

/** Curvature applied to a light ray at p (add `accel * step` to the direction, then renormalize). */
export function gravityAt(p: Vec2, fields: WorldField[]): Vec2 {
  let ax = 0;
  let ay = 0;
  for (const f of fields) {
    const dx = f.x - p.x;
    const dy = f.y - p.y;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    const fade = 1 / (1 + (r / f.reach) ** 4);
    const m = (f.k / r2) * fade;
    ax += (dx / r) * m;
    ay += (dy / r) * m;
  }
  return { x: ax, y: ay };
}

/** Returns the field whose horizon contains p, if any. */
export function capturedBy(p: Vec2, fields: WorldField[]): WorldField | undefined {
  return fields.find((f) => (p.x - f.x) ** 2 + (p.y - f.y) ** 2 < f.horizon * f.horizon);
}

/** Step length for marching a ray: fine near a hole, coarse far away. */
export function marchStep(p: Vec2, fields: WorldField[]): number {
  let step = 80;
  for (const f of fields) {
    const r = Math.hypot(p.x - f.x, p.y - f.y);
    const s = r > f.reach * 2.5 ? 80 : 0.08 * (r - f.horizon) + 1.2;
    step = Math.min(step, s);
  }
  return Math.max(1.2, step);
}

/** Visual space-time warp for the background grid: pulls points toward each hole. */
export function warpPoint(p: Vec2, fields: WorldField[]): Vec2 {
  let x = p.x;
  let y = p.y;
  for (const f of fields) {
    const dx = f.x - p.x;
    const dy = f.y - p.y;
    const r = Math.hypot(dx, dy);
    const scaleR = f.horizon * (1.6 + f.k / (f.horizon * 1.8));
    const g = Math.min(0.96, 1 / (1 + (r / scaleR) ** 1.6));
    x += dx * g;
    y += dy * g;
  }
  return { x, y };
}
