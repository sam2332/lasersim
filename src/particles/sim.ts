import { SPECIES, sigmaPx } from './species';

/**
 * 2D Lennard-Jones molecular dynamics in a rectangular box [0,w]×[0,h].
 *
 *  - velocity Verlet integration with an adaptive timestep
 *  - cell lists (cutoff 2.5σ) so cost grows ~linearly with particle count
 *  - Lorentz–Berthelot mixing for unlike pairs
 *  - walls are specular (insulating) or diffuse thermal (re-emit at wall temperature)
 *  - pressure from momentum delivered to the walls; temperature from kinetic energy
 *
 * Units: px, amu, K (k_B = 1). Pure data — no rendering — so it can move to a worker.
 */

const CUTOFF = 2.5;
const BASE_DT = 0.04;
const MAX_SUBSTEPS = 48;
/** Forces are evaluated no closer than this fraction of σ (keeps overlaps from exploding). */
const MIN_R = 0.8;

interface PairTable {
  sig2: Float64Array;
  eps24: Float64Array;
  rc2: Float64Array;
  rmin2: Float64Array;
}

function buildPairs(): PairTable {
  const n = SPECIES.length;
  const t: PairTable = { sig2: new Float64Array(n * n), eps24: new Float64Array(n * n), rc2: new Float64Array(n * n), rmin2: new Float64Array(n * n) };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const s = (sigmaPx(SPECIES[i]) + sigmaPx(SPECIES[j])) / 2;
      const e = Math.sqrt(SPECIES[i].epsilon * SPECIES[j].epsilon);
      const k = i * n + j;
      t.sig2[k] = s * s;
      t.eps24[k] = 24 * e;
      t.rc2[k] = (CUTOFF * s) ** 2;
      t.rmin2[k] = (MIN_R * s) ** 2;
    }
  }
  return t;
}

const PAIRS = buildPairs();
const NS = SPECIES.length;
const MASS = new Float64Array(SPECIES.map((s) => s.mass));
const RADIUS = new Float64Array(SPECIES.map((s) => sigmaPx(s) / 2));
const SIGMA_MAX = Math.max(...SPECIES.map(sigmaPx));

/** Standard normal sample (Box–Muller). */
function gauss(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

export interface WallOptions {
  /** Wall temperature in K. */
  temperature: number;
  /** 0 = insulating (specular), 1 = fully thermal (diffuse re-emission). */
  accommodation: number;
  /** Downward acceleration, px / t0². */
  gravity: number;
  /** Remove particles that hit the vent (middle third of the top wall). */
  vent: boolean;
  /** Berendsen thermostat strength toward `temperature` (0 = off; ~0.02 = gentle). */
  thermostat?: number;
}

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** A hole in a wall (a pipe mouth). `from`/`to` run along the wall (y for left/right, x for top/bottom). */
export interface Opening {
  key: string;
  side: Side;
  from: number;
  to: number;
}

/** A particle that left through an opening this step. */
export interface Exit {
  key: string;
  species: number;
  /** 0..1 position across the opening. */
  fraction: number;
  /** Outward normal speed and tangential velocity. */
  vn: number;
  vt: number;
}

export class ParticleSim {
  n = 0;
  x = new Float64Array(256);
  y = new Float64Array(256);
  vx = new Float64Array(256);
  vy = new Float64Array(256);
  ax = new Float64Array(256);
  ay = new Float64Array(256);
  sp = new Uint8Array(256);

  walls: WallOptions = { temperature: 293, accommodation: 0.5, gravity: 0, vent: false };

  /**
   * 2D pressure (K/px², i.e. energy per area) from the virial theorem:
   * P·A = Σ½mv² + ½ Σ_pairs r·F. Uses every particle every step, so it is far
   * less noisy than counting wall hits. Smoothed over a few time units.
   */
  pressure = 0;
  private virial = 0;
  /** Simulation time elapsed (t0). */
  time = 0;

  /** Right wall position; below `w` it is a piston. */
  right: number;
  /** Where the piston is heading (null = parked at the full width). */
  pistonTarget: number | null = null;
  /** Max piston speed, px / t0. */
  pistonSpeed = 0.8;
  private pistonU = 0;

  openings: Opening[] = [];
  /** Particles that left through openings since the caller last drained this. */
  exits: Exit[] = [];

  private head = new Int32Array(0);
  private next = new Int32Array(256);
  private cell = SIGMA_MAX * CUTOFF;
  private cols = 1;
  private rows = 1;

  constructor(
    public w: number,
    public h: number,
  ) {
    this.right = w;
  }

  // ------------------------------------------------------------------ editing

  /** True if a molecule of `species` fits at (x, y) without overlapping another. */
  isFree(species: number, x: number, y: number, minGap = 1.05): boolean {
    const r = RADIUS[species];
    if (x < r || y < r || x > this.right - r || y > this.h - r) return false;
    const s = sigmaPx(SPECIES[species]);
    for (let i = 0; i < this.n; i++) {
      const d = (s + 2 * RADIUS[this.sp[i]]) / 2;
      const dx = this.x[i] - x;
      const dy = this.y[i] - y;
      if (dx * dx + dy * dy < (minGap * d) ** 2) return false;
    }
    return true;
  }

  /** Add a particle with Maxwell–Boltzmann velocity at temperature T. Returns false if crowded. */
  spawn(species: number, x: number, y: number, T: number, minGap = 1.05): boolean {
    if (!this.isFree(species, x, y, minGap)) return false;
    this.ensure(this.n + 1);
    const i = this.n++;
    const sd = Math.sqrt(T / MASS[species]);
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = gauss() * sd;
    this.vy[i] = gauss() * sd;
    this.ax[i] = 0;
    this.ay[i] = 0;
    this.sp[i] = species;
    return true;
  }

  /** Fill a region with up to `count` particles at random free spots. */
  fill(species: number, count: number, T: number, x0 = 0, y0 = 0, x1 = this.right, y1 = this.h): number {
    let added = 0;
    for (let tries = 0; added < count && tries < count * 30; tries++) {
      if (this.spawn(species, x0 + Math.random() * (x1 - x0), y0 + Math.random() * (y1 - y0), T)) added++;
    }
    return added;
  }

  removeAt(i: number): void {
    const last = --this.n;
    if (i === last) return;
    this.x[i] = this.x[last];
    this.y[i] = this.y[last];
    this.vx[i] = this.vx[last];
    this.vy[i] = this.vy[last];
    this.ax[i] = this.ax[last];
    this.ay[i] = this.ay[last];
    this.sp[i] = this.sp[last];
  }

  removeInRadius(cx: number, cy: number, r: number): number {
    let removed = 0;
    for (let i = this.n - 1; i >= 0; i--) {
      if ((this.x[i] - cx) ** 2 + (this.y[i] - cy) ** 2 < r * r) {
        this.removeAt(i);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.n = 0;
  }

  /** Scale thermal motion inside a radius (heat > 1, cool < 1). */
  scaleVelocities(cx: number, cy: number, r: number, factor: number): void {
    for (let i = 0; i < this.n; i++) {
      if ((this.x[i] - cx) ** 2 + (this.y[i] - cy) ** 2 < r * r) {
        this.vx[i] *= factor;
        this.vy[i] *= factor;
      }
    }
  }

  push(cx: number, cy: number, r: number, dvx: number, dvy: number): void {
    for (let i = 0; i < this.n; i++) {
      const d2 = (this.x[i] - cx) ** 2 + (this.y[i] - cy) ** 2;
      if (d2 < r * r) {
        const k = 1 - Math.sqrt(d2) / r;
        this.vx[i] += dvx * k;
        this.vy[i] += dvy * k;
      }
    }
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.right = this.pistonTarget === null ? w : Math.min(this.right, w);
    for (let i = this.n - 1; i >= 0; i--) {
      const r = RADIUS[this.sp[i]];
      if (w < 2 * r || h < 2 * r) {
        this.removeAt(i);
        continue;
      }
      this.x[i] = Math.min(Math.max(this.x[i], r), this.right - r);
      this.y[i] = Math.min(Math.max(this.y[i], r), h - r);
    }
  }

  /** Add a particle coming in through an opening (from a connected pipe). */
  inject(key: string, species: number, fraction: number, vn: number, vt: number): boolean {
    const o = this.openings.find((x) => x.key === key);
    if (!o) return false;
    const r = RADIUS[species];
    for (let attempt = 0; attempt < 5; attempt++) {
      const f = attempt === 0 ? fraction : Math.random();
      const along = o.from + Math.min(1, Math.max(0, f)) * (o.to - o.from);
      const [x, y, vx, vy] =
        o.side === 'left'
          ? [r + 0.5, along, vn, vt]
          : o.side === 'right'
            ? [this.right - r - 0.5, along, -vn, vt]
            : o.side === 'top'
              ? [along, r + 0.5, vt, vn]
              : [along, this.h - r - 0.5, vt, -vn];
      if (!this.isFree(species, x, y, 0.95)) continue;
      this.add(species, x, y, vx, vy);
      return true;
    }
    return false;
  }

  /** Append a particle with an explicit velocity (pipes, gas inlets). */
  add(species: number, x: number, y: number, vx: number, vy: number): void {
    this.ensure(this.n + 1);
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.ax[i] = 0;
    this.ay[i] = 0;
    this.sp[i] = species;
  }

  // ------------------------------------------------------------------ stats

  /** Kinetic temperature in K (2 degrees of freedom per particle). */
  temperature(): number {
    if (!this.n) return 0;
    let ke = 0;
    for (let i = 0; i < this.n; i++) ke += MASS[this.sp[i]] * (this.vx[i] ** 2 + this.vy[i] ** 2);
    return ke / (2 * this.n);
  }

  countBySpecies(): number[] {
    const counts = new Array(NS).fill(0);
    for (let i = 0; i < this.n; i++) counts[this.sp[i]]++;
    return counts;
  }

  // ------------------------------------------------------------------ dynamics

  /** Advance by `duration` sim time units. Returns the number of substeps taken. */
  advance(duration: number): number {
    let t = 0;
    let steps = 0;
    while (t < duration && steps < MAX_SUBSTEPS) {
      const dt = Math.min(this.stableDt(), duration - t);
      this.step(dt);
      t += dt;
      steps++;
    }
    return steps;
  }

  private stableDt(): number {
    let vmax2 = 0;
    for (let i = 0; i < this.n; i++) {
      const v2 = this.vx[i] ** 2 + this.vy[i] ** 2;
      if (v2 > vmax2) vmax2 = v2;
    }
    const vmax = Math.sqrt(vmax2);
    // Never move more than ~8% of the smallest molecule per step.
    return vmax > 0 ? Math.max(0.002, Math.min(BASE_DT, (0.08 * 2 * RADIUS[0]) / vmax)) : BASE_DT;
  }

  private step(dt: number): void {
    // Move the piston toward its target at a limited speed.
    const target = Math.min(this.pistonTarget ?? this.w, this.w);
    const diff = target - this.right;
    this.pistonU = Math.abs(diff) < 1e-6 ? 0 : Math.max(-this.pistonSpeed, Math.min(this.pistonSpeed, diff / dt));
    this.right += this.pistonU * dt;
    const n = this.n;
    const half = dt / 2;
    for (let i = 0; i < n; i++) {
      this.vx[i] += this.ax[i] * half;
      this.vy[i] += this.ay[i] * half;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
    }
    this.collideWalls();
    this.computeForces();
    for (let i = 0; i < this.n; i++) {
      this.vx[i] += this.ax[i] * half;
      this.vy[i] += this.ay[i] * half;
    }
    const tau = this.walls.thermostat ?? 0;
    if (tau > 0 && this.n) {
      const T = this.temperature();
      if (T > 0) {
        const lambda = Math.sqrt(1 + Math.min(1, tau * dt) * (this.walls.temperature / T - 1));
        for (let i = 0; i < this.n; i++) {
          this.vx[i] *= lambda;
          this.vy[i] *= lambda;
        }
      }
    }
    this.time += dt;
    let ke2 = 0;
    for (let i = 0; i < this.n; i++) ke2 += MASS[this.sp[i]] * (this.vx[i] ** 2 + this.vy[i] ** 2);
    const area = Math.max(1, this.right * this.h);
    const instant = this.n ? (ke2 / 2 + this.virial / 2) / area : 0;
    this.pressure += (instant - this.pressure) * Math.min(1, dt / 3);
  }

  private collideWalls(): void {
    const { temperature: T, accommodation, vent } = this.walls;
    const ventLo = this.w / 3;
    const ventHi = (2 * this.w) / 3;
    const R = this.right;
    const pistonActive = R < this.w - 1e-6;
    for (let i = this.n - 1; i >= 0; i--) {
      const s = this.sp[i];
      const r = RADIUS[s];
      const m = MASS[s];
      const sd = Math.sqrt(T / m);
      const thermal = Math.random() < accommodation;
      if (this.x[i] < r) {
        if (this.exitThrough('left', this.y[i], i, -this.vx[i], this.vy[i])) continue;
        this.x[i] = 2 * r - this.x[i];
        this.bounce(i, 'x', 1, thermal, sd, 0);
      } else if (this.x[i] > R - r) {
        if (!pistonActive && this.exitThrough('right', this.y[i], i, this.vx[i], this.vy[i])) continue;
        this.x[i] = 2 * (R - r) - this.x[i];
        this.bounce(i, 'x', -1, thermal, sd, this.pistonU);
      }
      if (this.y[i] < r) {
        if (vent && this.x[i] > ventLo && this.x[i] < ventHi) {
          this.removeAt(i);
          continue;
        }
        if (this.exitThrough('top', this.x[i], i, -this.vy[i], this.vx[i])) continue;
        this.y[i] = 2 * r - this.y[i];
        this.bounce(i, 'y', 1, thermal, sd, 0);
      } else if (this.y[i] > this.h - r) {
        if (this.exitThrough('bottom', this.x[i], i, this.vy[i], this.vx[i])) continue;
        this.y[i] = 2 * (this.h - r) - this.y[i];
        this.bounce(i, 'y', -1, thermal, sd, 0);
      }
      // Safety net for anything that tunnelled far out.
      this.x[i] = Math.min(Math.max(this.x[i], r), R - r);
      this.y[i] = Math.min(Math.max(this.y[i], r), this.h - r);
    }
  }

  /** If the particle is inside an opening on `side`, record its exit and remove it. */
  private exitThrough(side: Side, along: number, i: number, vnOut: number, vt: number): boolean {
    for (const o of this.openings) {
      if (o.side !== side || along < o.from || along > o.to) continue;
      this.exits.push({ key: o.key, species: this.sp[i], fraction: (along - o.from) / (o.to - o.from || 1), vn: Math.abs(vnOut), vt });
      this.removeAt(i);
      return true;
    }
    return false;
  }

  /**
   * Reflect off a wall whose inward normal points along `sign` on `axis`.
   * `u` is the wall velocity along the axis (a moving piston). Bouncing off an
   * approaching wall speeds molecules up, which is how compression heats a gas.
   */
  private bounce(i: number, axis: 'x' | 'y', sign: 1 | -1, thermal: boolean, sd: number, u: number): void {
    const vn = axis === 'x' ? this.vx : this.vy;
    const vt = axis === 'x' ? this.vy : this.vx;
    const incoming = Math.abs(vn[i] - u);
    let outgoing: number;
    if (thermal) {
      // Diffuse emission from a wall at temperature T: Rayleigh-distributed normal speed.
      let r = 0;
      while (r === 0) r = Math.random();
      outgoing = sd * Math.sqrt(-2 * Math.log(r));
      vt[i] = gauss() * sd;
    } else {
      outgoing = incoming;
    }
    vn[i] = u + sign * outgoing;
  }

  private computeForces(): void {
    const n = this.n;
    const g = this.walls.gravity;
    this.ax.fill(0, 0, n);
    this.ay.fill(0, 0, n);
    this.virial = 0;
    // Build the cell list.
    this.cols = Math.max(1, Math.floor(this.w / this.cell));
    this.rows = Math.max(1, Math.floor(this.h / this.cell));
    const cw = this.w / this.cols;
    const ch = this.h / this.rows;
    const cells = this.cols * this.rows;
    if (this.head.length < cells) this.head = new Int32Array(cells);
    this.head.fill(-1, 0, cells);
    if (this.next.length < n) this.next = new Int32Array(this.x.length);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(this.x[i] / cw)));
      const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(this.y[i] / ch)));
      const c = cy * this.cols + cx;
      this.next[i] = this.head[c];
      this.head[c] = i;
    }
    // Half-shell neighbour sweep: self, E, SW, S, SE.
    const offsets = [
      [0, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const c = cy * this.cols + cx;
        for (const [ox, oy] of offsets) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
          const c2 = ny * this.cols + nx;
          for (let i = this.head[c]; i !== -1; i = this.next[i]) {
            for (let j = c2 === c ? this.next[i] : this.head[c2]; j !== -1; j = this.next[j]) this.pair(i, j);
          }
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const m = MASS[this.sp[i]];
      this.ax[i] /= m;
      this.ay[i] = this.ay[i] / m + g;
    }
  }

  private pair(i: number, j: number): void {
    const dx = this.x[i] - this.x[j];
    const dy = this.y[i] - this.y[j];
    let r2 = dx * dx + dy * dy;
    const k = this.sp[i] * NS + this.sp[j];
    if (r2 >= PAIRS.rc2[k]) return;
    if (r2 < PAIRS.rmin2[k]) r2 = PAIRS.rmin2[k];
    const s2 = PAIRS.sig2[k] / r2;
    const s6 = s2 * s2 * s2;
    // F·r / r² for U = 4ε[(σ/r)¹² − (σ/r)⁶]
    const f = (PAIRS.eps24[k] * s6 * (2 * s6 - 1)) / r2;
    this.virial += f * (dx * dx + dy * dy);
    this.ax[i] += f * dx;
    this.ay[i] += f * dy;
    this.ax[j] -= f * dx;
    this.ay[j] -= f * dy;
  }

  private ensure(capacity: number): void {
    if (capacity <= this.x.length) return;
    const size = Math.max(capacity, this.x.length * 2);
    const grow = <T extends Float64Array | Uint8Array>(a: T, make: (n: number) => T): T => {
      const b = make(size);
      b.set(a);
      return b;
    };
    this.x = grow(this.x, (s) => new Float64Array(s));
    this.y = grow(this.y, (s) => new Float64Array(s));
    this.vx = grow(this.vx, (s) => new Float64Array(s));
    this.vy = grow(this.vy, (s) => new Float64Array(s));
    this.ax = grow(this.ax, (s) => new Float64Array(s));
    this.ay = grow(this.ay, (s) => new Float64Array(s));
    this.sp = grow(this.sp, (s) => new Uint8Array(s));
  }

  // ------------------------------------------------------------------ persistence

  /** Compact base64 snapshot: x, y (quarter-pixel Uint16) + species byte per particle. */
  snapshot(): string {
    const bytes = new Uint8Array(this.n * 5);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < this.n; i++) {
      view.setUint16(i * 5, Math.round(this.x[i] * 4), true);
      view.setUint16(i * 5 + 2, Math.round(this.y[i] * 4), true);
      bytes[i * 5 + 4] = this.sp[i];
    }
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /** Restore positions from a snapshot; velocities are drawn fresh at temperature T. */
  restore(data: string, T: number): void {
    this.n = 0;
    if (!data) return;
    let bin: string;
    try {
      bin = atob(data);
    } catch {
      return;
    }
    const count = Math.floor(bin.length / 5);
    this.ensure(count);
    for (let k = 0; k < count; k++) {
      const o = k * 5;
      const x = (bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8)) / 4;
      const y = (bin.charCodeAt(o + 2) | (bin.charCodeAt(o + 3) << 8)) / 4;
      const s = bin.charCodeAt(o + 4);
      if (s >= NS) continue;
      const i = this.n++;
      const sd = Math.sqrt(T / MASS[s]);
      this.x[i] = Math.min(Math.max(x, RADIUS[s]), this.w - RADIUS[s]);
      this.y[i] = Math.min(Math.max(y, RADIUS[s]), this.h - RADIUS[s]);
      this.vx[i] = gauss() * sd;
      this.vy[i] = gauss() * sd;
      this.ax[i] = 0;
      this.ay[i] = 0;
      this.sp[i] = s;
    }
    this.computeForces();
  }
}

export { MASS as SPECIES_MASS, RADIUS as SPECIES_RADIUS };
