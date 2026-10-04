import { Frame, normalize, type Vec2 } from '../core/math';
import { getDef } from '../core/registry';
import type { Port, SceneElement } from '../core/types';

export function portsOf(el: SceneElement): Port[] {
  return getDef(el.type)?.ports?.(el.props) ?? [];
}

export function findPort(el: SceneElement, id: string): Port | undefined {
  return portsOf(el).find((p) => p.id === id);
}

export function portWorld(el: SceneElement, port: Port): Vec2 {
  return new Frame(el.x, el.y, el.rotation).toWorld(port.position);
}

/** World direction a wire should leave this port in. */
export function portNormalWorld(el: SceneElement, port: Port): Vec2 {
  const n = port.normal ?? normalize(port.position);
  return new Frame(el.x, el.y, el.rotation).dirToWorld(n);
}

/** Smooth cable between two ports: a cubic Bézier sampled into points. */
export function wireCurve(a: Vec2, na: Vec2, b: Vec2, nb: Vec2, steps = 28): Vec2[] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const k = Math.min(160, Math.max(28, d * 0.45));
  const p1 = { x: a.x + na.x * k, y: a.y + na.y * k };
  const p2 = { x: b.x + nb.x * k, y: b.y + nb.y * k };
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.y,
    });
  }
  return pts;
}

/** Helper for element files: evenly spaced ports along a vertical edge. */
export function portColumn(ids: string[], dir: 'in' | 'out', x: number, spacing: number, labels?: string[]): Port[] {
  return ids.map((id, i) => ({
    id,
    dir,
    position: { x, y: (i - (ids.length - 1) / 2) * spacing },
    normal: { x: Math.sign(x) || 1, y: 0 },
    label: labels?.[i],
  }));
}
