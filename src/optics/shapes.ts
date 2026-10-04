import type { Vec2 } from '../core/math';
import type { Material, Surface } from '../core/types';

/**
 * Reusable surface builders. Elements compose these instead of writing
 * intersection code, so optics and drawing always share one geometry.
 */

/** Closed convex polygon; normals point outward (away from the centroid). */
export function polygonSurfaces(points: Vec2[], material: Material): Surface[] {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    const mx = (a.x + b.x) / 2 - cx;
    const my = (a.y + b.y) / 2 - cy;
    return { kind: 'segment', a, b, material, orient: { x: mx, y: my } } satisfies Surface;
  });
}

export function rectPoints(w: number, h: number, cx = 0, cy = 0): Vec2[] {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

export function rectSurfaces(w: number, h: number, material: Material, cx = 0, cy = 0): Surface[] {
  return polygonSurfaces(rectPoints(w, h, cx, cy), material);
}

export function circleSurface(r: number, material: Material, c: Vec2 = { x: 0, y: 0 }): Surface {
  return { kind: 'arc', c, r, material, orient: undefined };
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * A curve through the chord endpoints (x0, ±h) whose middle sits at (x0 + bulge, 0).
 * bulge = 0 is a flat segment; |bulge| is limited to < h (less than a half circle).
 * Used for both lens faces and curved mirrors.
 */
export class BulgeCurve {
  readonly flat: boolean;
  readonly r: number;
  readonly cx: number;
  private readonly sign: number;

  constructor(
    readonly x0: number,
    readonly h: number,
    readonly bulge: number,
  ) {
    this.flat = Math.abs(bulge) < 0.25;
    this.sign = Math.sign(bulge) || 1;
    this.r = this.flat ? Infinity : (h * h + bulge * bulge) / (2 * Math.abs(bulge));
    this.cx = this.flat ? x0 : x0 + bulge - this.sign * this.r;
  }

  /** x of the curve at height y (|y| ≤ h). */
  xAt(y: number): number {
    if (this.flat) return this.x0;
    return this.cx + this.sign * Math.sqrt(Math.max(0, this.r * this.r - y * y));
  }

  /** Signed radius of curvature (Infinity when flat). Positive when the centre lies at +x. */
  get signedRadius(): number {
    return this.flat ? Infinity : this.cx > this.x0 + this.bulge ? this.r : -this.r;
  }

  surface(material: Material, orient?: Vec2): Surface {
    const { x0, h } = this;
    if (this.flat) return { kind: 'segment', a: { x: x0, y: -h }, b: { x: x0, y: h }, material, orient };
    const sign = this.sign;
    return {
      kind: 'arc',
      c: { x: this.cx, y: 0 },
      r: this.r,
      material,
      orient,
      accept: (p) => Math.abs(p.y) <= h + 1e-6 && (p.x - x0) * sign >= -1e-6,
    };
  }

  /** Points along the curve from y = -h to y = +h (for drawing). */
  sample(steps = 32): Vec2[] {
    if (this.flat) return [{ x: this.x0, y: -this.h }, { x: this.x0, y: this.h }];
    const alpha = Math.asin(Math.min(1, this.h / this.r));
    const pts: Vec2[] = [];
    for (let i = 0; i <= steps; i++) {
      const phi = -alpha + (2 * alpha * i) / steps;
      pts.push({ x: this.cx + this.sign * this.r * Math.cos(phi), y: this.r * Math.sin(phi) });
    }
    return pts;
  }
}
