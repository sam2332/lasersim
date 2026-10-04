export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const neg = (a: Vec2): Vec2 => ({ x: -a.x, y: -a.y });

export function normalize(a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-12 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 };
}

export function rotate(a: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const snapTo = (v: number, step: number): number => Math.round(v / step) * step;
export const deg = (rad: number): number => (rad * 180) / Math.PI;
export const rad = (degrees: number): number => (degrees * Math.PI) / 180;

/** Rigid transform (translation + rotation) between an element's local frame and world space. */
export class Frame {
  readonly cos: number;
  readonly sin: number;
  constructor(
    readonly x: number,
    readonly y: number,
    readonly rotation: number,
  ) {
    this.cos = Math.cos(rotation);
    this.sin = Math.sin(rotation);
  }

  toWorld(p: Vec2): Vec2 {
    return { x: this.x + p.x * this.cos - p.y * this.sin, y: this.y + p.x * this.sin + p.y * this.cos };
  }

  toLocal(p: Vec2): Vec2 {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    return { x: dx * this.cos + dy * this.sin, y: -dx * this.sin + dy * this.cos };
  }

  dirToWorld(d: Vec2): Vec2 {
    return { x: d.x * this.cos - d.y * this.sin, y: d.x * this.sin + d.y * this.cos };
  }

  dirToLocal(d: Vec2): Vec2 {
    return { x: d.x * this.cos + d.y * this.sin, y: -d.x * this.sin + d.y * this.cos };
  }
}
