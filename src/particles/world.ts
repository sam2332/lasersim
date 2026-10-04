import { settings } from '../core/settings';
import type { Scene, SceneElement } from '../core/types';
import { ParticleSim, SPECIES_MASS, SPECIES_RADIUS, type Side } from './sim';
import { pressureToAtm, speciesIndex } from './species';

/** Chamber props the particle world cares about (the element file owns the full type). */
export interface ChamberProps {
  width: number;
  height: number;
  wallTemp: number;
  /** 0 = insulated, 1 = fully thermal walls. */
  thermal: number;
  thermostat: boolean;
  gravity: number;
  heaterTemp: number;
  /** Right wall is a piston. */
  piston: boolean;
  /** Piston position as a fraction of the width (when unwired, or while its input is ON). */
  pistonPos: number;
  inletSpecies: string;
  /** Particles per second while the inlet input is ON. */
  inletRate: number;
  inletT: number;
  /** Initial contents when there is no snapshot: [{ species, count, T, region? }]. */
  fill: FillSpec[];
  /** Compact particle snapshot (positions + species). */
  particles: string;
}

export interface PipeProps {
  dx: number;
  dy: number;
  bore: number;
  open: boolean;
}

export interface FillSpec {
  species: string;
  count: number;
  T: number;
  /** Fractional region [x0, y0, x1, y1] of the chamber; whole chamber if omitted. */
  region?: [number, number, number, number];
}

export interface ChamberStats {
  n: number;
  temperature: number;
  pressureAtm: number;
  counts: number[];
}

interface Inputs {
  heat: boolean;
  vent: boolean;
  inlet: boolean;
  piston: boolean;
  pistonWired: boolean;
}

interface Runtime {
  sim: ParticleSim;
  /** Snapshot string this runtime last loaded or wrote. */
  snapshot: string;
  fillKey: string;
  inputs: Inputs;
  inletDebt: number;
  stats: ChamberStats;
}

interface PipeEnd {
  chamber: string;
  side: Side;
  from: number;
  to: number;
}

interface PipeLink {
  a: PipeEnd | null;
  b: PipeEnd | null;
  open: boolean;
  /** Smoothed particles per second, positive = a → b. */
  flow: number;
  transferred: number;
}

/** Interior inset from the chamber's outer size to the gas region (wall thickness). */
export const WALL = 10;
/** How close a pipe end must be to a chamber wall to connect. */
const SNAP = 22;

/**
 * Owns one molecular-dynamics simulation per chamber element, keeps it in sync
 * with the scene (resize, wall settings, snapshots from undo/load) and moves
 * particles through pipes between chambers.
 */
class ParticleWorld {
  private runtimes = new Map<string, Runtime>();
  private pipes = new Map<string, PipeLink>();
  private valves = new Map<string, boolean>();

  get(id: string): ParticleSim | undefined {
    return this.runtimes.get(id)?.sim;
  }

  stats(id: string): ChamberStats {
    return this.runtimes.get(id)?.stats ?? { n: 0, temperature: 0, pressureAtm: 0, counts: [] };
  }

  pipe(id: string): PipeLink | undefined {
    return this.pipes.get(id);
  }

  setInputs(id: string, inputs: Inputs): void {
    const rt = this.runtimes.get(id);
    if (rt) rt.inputs = inputs;
  }

  setValve(id: string, open: boolean): void {
    this.valves.set(id, open);
  }

  /** Create/remove/update runtimes and pipe connections to match the scene. */
  sync(scene: Scene): void {
    const seen = new Set<string>();
    for (const el of scene.elements) {
      if (el.type !== 'chamber') continue;
      seen.add(el.id);
      this.syncChamber(el as unknown as SceneElement<ChamberProps>);
    }
    for (const id of [...this.runtimes.keys()]) if (!seen.has(id)) this.runtimes.delete(id);

    const chambers = scene.elements.filter((e) => e.type === 'chamber') as unknown as SceneElement<ChamberProps>[];
    const pipeIds = new Set<string>();
    for (const el of scene.elements) {
      if (el.type !== 'pipe') continue;
      pipeIds.add(el.id);
      const p = el.props as unknown as PipeProps;
      const prev = this.pipes.get(el.id);
      this.pipes.set(el.id, {
        a: this.connect({ x: el.x, y: el.y }, p.bore, chambers),
        b: this.connect({ x: el.x + p.dx, y: el.y + p.dy }, p.bore, chambers),
        open: p.open,
        flow: prev?.flow ?? 0,
        transferred: 0,
      });
    }
    for (const id of [...this.pipes.keys()]) if (!pipeIds.has(id)) this.pipes.delete(id);
  }

  /** Find the chamber wall a pipe end sits on, and the opening it makes there. */
  private connect(pt: { x: number; y: number }, bore: number, chambers: SceneElement<ChamberProps>[]): PipeEnd | null {
    let best: PipeEnd | null = null;
    let bestD = SNAP;
    for (const c of chambers) {
      const x0 = c.x - c.props.width / 2;
      const x1 = c.x + c.props.width / 2;
      const y0 = c.y - c.props.height / 2;
      const y1 = c.y + c.props.height / 2;
      const iw = c.props.width - 2 * WALL;
      const ih = c.props.height - 2 * WALL;
      const along = (v: number, len: number): [number, number] => [Math.max(0, v - bore / 2), Math.min(len, v + bore / 2)];
      const candidates: [Side, number, boolean, number][] = [
        ['left', Math.abs(pt.x - x0), pt.y > y0 && pt.y < y1, pt.y - y0 - WALL],
        ['right', Math.abs(pt.x - x1), pt.y > y0 && pt.y < y1, pt.y - y0 - WALL],
        ['top', Math.abs(pt.y - y0), pt.x > x0 && pt.x < x1, pt.x - x0 - WALL],
        ['bottom', Math.abs(pt.y - y1), pt.x > x0 && pt.x < x1, pt.x - x0 - WALL],
      ];
      for (const [side, d, inside, pos] of candidates) {
        if (!inside || d >= bestD) continue;
        const [from, to] = along(pos, side === 'left' || side === 'right' ? ih : iw);
        if (to - from < 4) continue;
        bestD = d;
        best = { chamber: c.id, side, from, to };
      }
    }
    return best;
  }

  private syncChamber(el: SceneElement<ChamberProps>): void {
    const p = el.props;
    const w = Math.max(20, p.width - 2 * WALL);
    const h = Math.max(20, p.height - 2 * WALL);
    let rt = this.runtimes.get(el.id);
    const fillKey = JSON.stringify(p.fill);
    if (!rt) {
      rt = {
        sim: new ParticleSim(w, h),
        snapshot: '',
        fillKey: '',
        inputs: { heat: false, vent: false, inlet: false, piston: false, pistonWired: false },
        inletDebt: 0,
        stats: { n: 0, temperature: 0, pressureAtm: 0, counts: [] },
      };
      this.runtimes.set(el.id, rt);
      this.load(rt, p, fillKey);
    } else {
      if (rt.sim.w !== w || rt.sim.h !== h) rt.sim.resize(w, h);
      // Undo/redo/load replaced the stored contents → reload them.
      if (p.particles !== rt.snapshot || (!p.particles && fillKey !== rt.fillKey)) this.load(rt, p, fillKey);
    }
    this.applyControls(rt, p);
  }

  private load(rt: Runtime, p: ChamberProps, fillKey: string): void {
    const { sim } = rt;
    rt.snapshot = p.particles;
    rt.fillKey = fillKey;
    if (p.particles) {
      sim.restore(p.particles, p.wallTemp);
    } else {
      sim.clear();
      for (const f of p.fill ?? []) {
        const [x0, y0, x1, y1] = f.region ?? [0, 0, 1, 1];
        sim.fill(speciesIndex(f.species), f.count, f.T, x0 * sim.w, y0 * sim.h, x1 * sim.w, y1 * sim.h);
      }
    }
    this.refreshStats(rt);
  }

  private applyControls(rt: Runtime, p: ChamberProps): void {
    const { sim, inputs } = rt;
    sim.walls = {
      temperature: inputs.heat ? p.heaterTemp : p.wallTemp,
      accommodation: p.thermal,
      gravity: p.gravity,
      vent: inputs.vent,
      thermostat: p.thermostat ? 0.05 : 0,
    };
    if (!p.piston) sim.pistonTarget = null;
    else {
      const compressed = !inputs.pistonWired || inputs.piston;
      sim.pistonTarget = compressed ? Math.max(0.1, p.pistonPos) * sim.w : sim.w;
    }
  }

  /** Advance every chamber by real time `dt` (seconds) and move particles through pipes. */
  update(dt: number, scene: Scene): void {
    if (!this.runtimes.size) return;
    const simTime = dt * settings.particleSpeed;

    // Open pipe mouths in the chamber walls.
    for (const rt of this.runtimes.values()) rt.sim.openings = [];
    for (const [id, link] of this.pipes) {
      link.open = this.valves.get(id) ?? link.open;
      if (!link.a || !link.b || !link.open) continue;
      for (const [end, key] of [
        [link.a, `${id}:a`],
        [link.b, `${id}:b`],
      ] as const) {
        this.runtimes.get(end.chamber)?.sim.openings.push({ key, side: end.side, from: end.from, to: end.to });
      }
    }

    for (const el of scene.elements) {
      const rt = this.runtimes.get(el.id);
      if (!rt) continue;
      const p = el.props as unknown as ChamberProps;
      this.applyControls(rt, p);
      if (rt.inputs.inlet && p.inletRate > 0) this.feedInlet(rt, p, dt);
      rt.sim.advance(simTime);
    }

    // Hand exiting particles to the chamber at the other end of each pipe.
    for (const link of this.pipes.values()) link.transferred = 0;
    for (const rt of this.runtimes.values()) {
      for (const ex of rt.sim.exits) {
        const [pipeId, end] = ex.key.split(':');
        const link = this.pipes.get(pipeId);
        const dest = end === 'a' ? link?.b : link?.a;
        if (!link || !dest) continue;
        if (this.runtimes.get(dest.chamber)?.sim.inject(`${pipeId}:${end === 'a' ? 'b' : 'a'}`, ex.species, ex.fraction, ex.vn, ex.vt)) {
          link.transferred += end === 'a' ? 1 : -1;
        } else {
          // Far mouth is jammed: the molecule bounces back the way it came.
          rt.sim.inject(ex.key, ex.species, ex.fraction, ex.vn, -ex.vt);
        }
      }
      rt.sim.exits = [];
    }
    for (const link of this.pipes.values()) link.flow = link.flow * 0.95 + (dt > 0 ? link.transferred / dt : 0) * 0.05;
    for (const rt of this.runtimes.values()) this.refreshStats(rt);
  }

  /** Inlet nozzle in the middle of the left wall. */
  private feedInlet(rt: Runtime, p: ChamberProps, dt: number): void {
    const s = speciesIndex(p.inletSpecies);
    rt.inletDebt += p.inletRate * dt;
    const sim = rt.sim;
    for (; rt.inletDebt >= 1; rt.inletDebt--) {
      const sd = Math.sqrt(p.inletT / SPECIES_MASS[s]);
      const y = sim.h / 2 + (Math.random() - 0.5) * Math.min(40, sim.h / 3);
      const x = SPECIES_RADIUS[s] + 1;
      // A crowded nozzle simply can't push more gas in (back-pressure).
      if (sim.isFree(s, x, y)) sim.add(s, x, y, sd * 2, (Math.random() - 0.5) * sd);
    }
  }

  private refreshStats(rt: Runtime): void {
    const { sim } = rt;
    rt.stats = { n: sim.n, temperature: sim.temperature(), pressureAtm: pressureToAtm(sim.pressure), counts: sim.countBySpecies() };
  }

  /** Current contents as a snapshot string, and remember it as ours. */
  takeSnapshot(id: string): string {
    const rt = this.runtimes.get(id);
    if (!rt) return '';
    rt.snapshot = rt.sim.snapshot();
    return rt.snapshot;
  }
}

export const particleWorld = new ParticleWorld();
