import { Frame, type Vec2 } from '../core/math';
import { getDef } from '../core/registry';
import { NO_SIGNALS, type ElementDef, type Hit, type OpticsSettings, type Ray, type Scene, type SceneElement, type Signals, type Surface } from '../core/types';
import { distanceToRay, exitBoard, intersectSurface } from './geometry';
import { capturedBy, gravityAt, makeWorldField, marchStep, type WorldField } from './gravity';

export interface BeamPath {
  points: Vec2[];
  wavelength: number;
  intensity: number;
}

export interface Glint {
  point: Vec2;
  wavelength: number;
  intensity: number;
}

export interface TraceResult {
  paths: BeamPath[];
  /** Points where beams struck something (drawn as sparkles). */
  glints: Glint[];
  /** Light energy deposited per element id. */
  energy: Map<string, number>;
  fields: WorldField[];
}

const LIMITS = {
  rays: 600,
  bounces: 80,
  steps: 8000,
  minIntensity: 0.025,
};

const T_MIN = 1e-4;
const NUDGE = 0.02;

interface Prepared {
  el: SceneElement;
  def: ElementDef;
  frame: Frame;
  surfaces: Surface[];
  radius: number;
}

/** `signals` supplies each element's current wired inputs (lasers with enable ports, shutters…). */
export function trace(scene: Scene, settings: OpticsSettings, signals?: Map<string, Signals>): TraceResult {
  const { width: W, height: H } = scene.board;
  const prepared: Prepared[] = [];
  const fields: WorldField[] = [];
  const queue: Ray[] = [];

  for (const el of scene.elements) {
    const def = getDef(el.type);
    if (!def) continue;
    const frame = new Frame(el.x, el.y, el.rotation);
    const sig = signals?.get(el.id) ?? NO_SIGNALS;
    const surfaces = def.surfaces?.(el.props, sig) ?? [];
    if (surfaces.length) prepared.push({ el, def, frame, surfaces, radius: def.boundsRadius(el.props) + 1 });
    const field = def.field?.(el.props);
    if (field) fields.push(makeWorldField(el.x, el.y, field.strength, field.horizon));
    for (const e of def.emit?.(el.props, sig) ?? []) {
      queue.push({
        origin: frame.toWorld(e.origin),
        dir: frame.dirToWorld(e.dir),
        wavelength: e.wavelength,
        intensity: e.intensity,
        pol: e.pol ?? null,
        depth: 0,
      });
    }
  }

  const result: TraceResult = { paths: [], glints: [], energy: new Map(), fields };
  const deposit = (id: string, amount: number) => result.energy.set(id, (result.energy.get(id) ?? 0) + amount);

  const nearestHit = (o: Vec2, d: Vec2, tMax: number): Hit | null => {
    let best: Hit | null = null;
    let bestT = tMax;
    for (const p of prepared) {
      if (distanceToRay(p.frame, o, d, Math.min(bestT, 1e6)) > p.radius) continue;
      const lo = p.frame.toLocal(o);
      const ld = p.frame.dirToLocal(d);
      for (const s of p.surfaces) {
        const h = intersectSurface(lo, ld, s, T_MIN, bestT);
        if (!h) continue;
        bestT = h.t;
        best = { t: h.t, point: p.frame.toWorld(h.point), normal: p.frame.dirToWorld(h.normal), element: p.el, surface: s };
      }
    }
    return best;
  };

  let processed = 0;
  while (queue.length && processed < LIMITS.rays) {
    const ray = queue.shift()!;
    processed++;
    const path: BeamPath = { points: [ray.origin], wavelength: ray.wavelength, intensity: ray.intensity };
    result.paths.push(path);

    let o = ray.origin;
    let d = ray.dir;
    for (let step = 0; step < LIMITS.steps; step++) {
      const stepLen = fields.length ? marchStep(o, fields) : Infinity;
      const toEdge = exitBoard(o, d, W, H);
      const hit = nearestHit(o, d, Math.min(stepLen, toEdge));

      if (hit) {
        path.points.push(hit.point);
        result.glints.push({ point: hit.point, wavelength: ray.wavelength, intensity: ray.intensity });
        if (ray.depth >= LIMITS.bounces) break;
        const material = hit.surface.material;
        const out = material.interact({ ray: { ...ray, origin: o, dir: d }, hit, settings, deposit });
        for (const r of out) {
          if (r.intensity < LIMITS.minIntensity) continue;
          const len = Math.hypot(r.dir.x, r.dir.y);
          const dir = { x: r.dir.x / len, y: r.dir.y / len };
          queue.push({
            origin: { x: hit.point.x + dir.x * NUDGE, y: hit.point.y + dir.y * NUDGE },
            dir,
            wavelength: r.wavelength ?? ray.wavelength,
            intensity: r.intensity,
            pol: r.pol === undefined ? ray.pol : r.pol,
            depth: ray.depth + 1,
          });
        }
        break;
      }

      if (toEdge <= stepLen) {
        path.points.push({ x: o.x + d.x * toEdge, y: o.y + d.y * toEdge });
        break;
      }

      // Free flight through curved space.
      o = { x: o.x + d.x * stepLen, y: o.y + d.y * stepLen };
      path.points.push(o);
      if (capturedBy(o, fields)) break;
      const a = gravityAt(o, fields);
      const nx = d.x + a.x * stepLen;
      const ny = d.y + a.y * stepLen;
      const nl = Math.hypot(nx, ny);
      d = { x: nx / nl, y: ny / nl };
    }
  }

  return result;
}
