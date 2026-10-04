import type { Vec2 } from '../core/math';
import type { MediumHit, Scene, SceneElement } from '../core/types';
import { MaterialField } from './field';
import { MATERIALS, MAT_INDEX } from './materials';

/** Rectangle / circle drawing ops so presets can build scenes without a snapshot. */
export type LayoutOp = { m: string; x: number; y: number; w: number; h: number } | { m: string; cx: number; cy: number; r: number };

export interface FieldProps {
  width: number;
  height: number;
  /** Screen pixels per cell. */
  cellPx: number;
  /** Metres per cell. */
  dx: number;
  /** Sim seconds of heat physics per real second. */
  timeScale: number;
  /** Watts delivered per unit of beam intensity. */
  beamWatts: number;
  ambient: number;
  /** Initial contents (cell coordinates) when there is no snapshot. */
  layout: LayoutOp[];
  /** Saved cells (run-length encoded). */
  data: string;
}

interface Runtime {
  field: MaterialField;
  snapshot: string;
  layoutKey: string;
  cellPx: number;
}

const OPTICS = MATERIALS.map((m) => (m.optics === 'clear' ? 0 : m.optics === 'absorb' ? 1 : 2));

/** One material simulation per field element, kept in sync with the scene. */
class FieldWorld {
  private runtimes = new Map<string, Runtime>();

  get(id: string): MaterialField | undefined {
    return this.runtimes.get(id)?.field;
  }

  get any(): boolean {
    return this.runtimes.size > 0;
  }

  sync(scene: Scene): void {
    const seen = new Set<string>();
    for (const el of scene.elements) {
      if (el.type !== 'material-field') continue;
      seen.add(el.id);
      this.syncOne(el as unknown as SceneElement<FieldProps>);
    }
    for (const id of [...this.runtimes.keys()]) if (!seen.has(id)) this.runtimes.delete(id);
  }

  private syncOne(el: SceneElement<FieldProps>): void {
    const p = el.props;
    const cols = Math.max(4, Math.round(p.width / p.cellPx));
    const rows = Math.max(4, Math.round(p.height / p.cellPx));
    const layoutKey = JSON.stringify(p.layout);
    let rt = this.runtimes.get(el.id);
    if (rt && (rt.field.cols !== cols || rt.field.rows !== rows || rt.field.dx !== p.dx)) {
      // Resized: carry the cells over.
      const data = rt.field.serialize();
      rt.field = new MaterialField(cols, rows, p.dx);
      rt.field.deserialize(data);
    }
    if (!rt) {
      rt = { field: new MaterialField(cols, rows, p.dx), snapshot: '', layoutKey: '', cellPx: p.cellPx };
      this.runtimes.set(el.id, rt);
      this.load(rt, p, layoutKey);
    } else if (p.data !== rt.snapshot || (!p.data && layoutKey !== rt.layoutKey)) {
      this.load(rt, p, layoutKey);
    }
    rt.cellPx = p.cellPx;
    rt.field.timeScale = p.timeScale;
    rt.field.ambient = p.ambient;
  }

  private load(rt: Runtime, p: FieldProps, layoutKey: string): void {
    const f = rt.field;
    f.mat.fill(0);
    f.T.fill(p.ambient);
    f.latent.fill(0);
    f.P.fill(0);
    rt.snapshot = p.data;
    rt.layoutKey = layoutKey;
    if (p.data) f.deserialize(p.data);
    else {
      for (const op of p.layout ?? []) {
        const m = MAT_INDEX[op.m];
        if (m === undefined) continue;
        if ('r' in op) f.paint(op.cx, op.cy, op.r, m);
        else for (let y = op.y; y < op.y + op.h; y++) for (let x = op.x; x < op.x + op.w; x++) if (x >= 0 && y >= 0 && x < f.cols && y < f.rows) f.set(y * f.cols + x, m);
      }
    }
    f.changed = true;
  }

  update(dt: number): boolean {
    let changed = false;
    for (const rt of this.runtimes.values()) {
      rt.field.update(dt);
      if (rt.field.changed) changed = true;
      rt.field.changed = false;
    }
    return changed;
  }

  commitBeams(): void {
    for (const rt of this.runtimes.values()) rt.field.commitBeams();
  }

  takeSnapshot(id: string): string {
    const rt = this.runtimes.get(id);
    if (!rt) return '';
    rt.snapshot = rt.field.serialize();
    return rt.snapshot;
  }

  /**
   * First cell along a world-space ray (within tMax) where light stops being
   * transparent: absorbing materials take the beam's power, metals reflect.
   */
  traceRay(el: SceneElement, o: Vec2, d: Vec2, tMax: number): MediumHit | null {
    const rt = this.runtimes.get(el.id);
    if (!rt) return null;
    const f = rt.field;
    const cs = rt.cellPx;
    const left = el.x - (f.cols * cs) / 2;
    const top = el.y - (f.rows * cs) / 2;
    // Clip to the field rectangle.
    let t0 = 0;
    let t1 = tMax;
    let enterAxis = -1;
    for (const [oa, da, lo, hi, axis] of [
      [o.x, d.x, left, left + f.cols * cs, 0],
      [o.y, d.y, top, top + f.rows * cs, 1],
    ] as const) {
      if (Math.abs(da) < 1e-12) {
        if (oa < lo || oa > hi) return null;
        continue;
      }
      let ta = (lo - oa) / da;
      let tb = (hi - oa) / da;
      if (ta > tb) [ta, tb] = [tb, ta];
      if (ta > t0) {
        t0 = ta;
        enterAxis = axis;
      }
      t1 = Math.min(t1, tb);
    }
    if (t0 > t1) return null;
    // Grid DDA (Amanatides & Woo).
    const gx0 = (o.x + d.x * t0 - left) / cs;
    const gy0 = (o.y + d.y * t0 - top) / cs;
    let cx = Math.min(f.cols - 1, Math.max(0, Math.floor(gx0)));
    let cy = Math.min(f.rows - 1, Math.max(0, Math.floor(gy0)));
    const stepX = d.x > 0 ? 1 : -1;
    const stepY = d.y > 0 ? 1 : -1;
    const tDeltaX = Math.abs(cs / (d.x || 1e-12));
    const tDeltaY = Math.abs(cs / (d.y || 1e-12));
    let tMaxX = t0 + (d.x > 0 ? (cx + 1 - gx0) : (gx0 - cx)) * tDeltaX;
    let tMaxY = t0 + (d.y > 0 ? (cy + 1 - gy0) : (gy0 - cy)) * tDeltaY;
    let t = t0;
    let axis = enterAxis;
    let first = t0 === 0; // ray starts inside: ignore the cell it starts in
    for (let guard = 0; guard < f.cols + f.rows + 4; guard++) {
      const cell = cy * f.cols + cx;
      const kind = OPTICS[f.mat[cell]];
      if (kind !== 0 && !first) {
        const normal = axis === 0 ? { x: -stepX, y: 0 } : axis === 1 ? { x: 0, y: -stepY } : { x: -d.x, y: -d.y };
        return { t, normal, cell, kind: kind === 1 ? 'absorb' : 'reflect' };
      }
      first = false;
      if (tMaxX < tMaxY) {
        t = tMaxX;
        tMaxX += tDeltaX;
        cx += stepX;
        axis = 0;
      } else {
        t = tMaxY;
        tMaxY += tDeltaY;
        cy += stepY;
        axis = 1;
      }
      if (t > t1 || cx < 0 || cy < 0 || cx >= f.cols || cy >= f.rows) return null;
    }
    return null;
  }

  deposit(id: string, cell: number, watts: number): void {
    this.runtimes.get(id)?.field.depositBeam(cell, watts);
  }
}

export const fieldWorld = new FieldWorld();
