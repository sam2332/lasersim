import { AIR, AMBIENT, MATERIALS, TO, type Phase } from './materials';

/**
 * Macro-scale material simulation on a cell grid (Powder-Toy style, but with
 * real material data). Each cell is a cube `dx` metres on a side.
 *
 * Per frame:
 *  1. motion   — powders fall/pile, liquids flow/level, gases rise/diffuse (density-ordered)
 *  2. state    — burning, detonation, phase changes with latent heat
 *  3. heat     — conduction (real k, ρ, cp), radiation εσT⁴ from hot surfaces, air convection
 *  4. pressure — blast waves spread through open space, break weak solids, push loose material
 *
 * Thermal physics runs in "sim seconds" (timeScale × real time) so heat moves
 * at a watchable pace; motion and flames run in real time.
 */

const PHASE_CODE: Record<Phase, number> = { empty: 0, solid: 1, powder: 2, liquid: 3, gas: 4, fire: 5 };
const EMPTY = 0;
const SOLID = 1;
const POWDER = 2;
const LIQUID = 3;
const GAS = 4;
const FIRE = 5;

const NM = MATERIALS.length;
const PH = new Uint8Array(MATERIALS.map((m) => PHASE_CODE[m.phase]));
const DENS = new Float32Array(MATERIALS.map((m) => m.density));
const CP = new Float32Array(MATERIALS.map((m) => m.cp));
const K = new Float32Array(MATERIALS.map((m) => m.k));
const FLOW = new Uint8Array(MATERIALS.map((m) => m.flow ?? 2));
const LIFETIME = new Float32Array(MATERIALS.map((m) => m.lifetime ?? 0));
const DECAY = new Int16Array(MATERIALS.map((m) => (m.decay ? TO(m.decay) : -1)));
const SPAWN_T = new Float32Array(MATERIALS.map((m) => m.spawnT ?? AMBIENT));

interface Tr {
  at: number;
  to: number;
  latent: number;
}
const tr = (t?: { at: number; to: string; latent: number }): Tr | null => (t ? { at: t.at, to: TO(t.to), latent: t.latent } : null);
const MELT = MATERIALS.map((m) => tr(m.melt));
const FREEZE = MATERIALS.map((m) => tr(m.freeze));
const BOIL = MATERIALS.map((m) => tr(m.boil));
const CONDENSE = MATERIALS.map((m) => tr(m.condense));
const BURN = MATERIALS.map((m) => (m.burn ? { ...m.burn, ashIdx: TO(m.burn.ash) } : null));
const EXPLOSIVE = MATERIALS.map((m) => m.explosive ?? null);
const BREAKS = MATERIALS.map((m) => (m.breaks ? { strength: m.breaks.strength, to: TO(m.breaks.to) } : null));

const FIRE_M = TO('fire');
const SMOKE_M = TO('smoke');
const STEAM_M = TO('steam');

const SIGMA_SB = 5.670374e-8;
const EMISSIVITY = 0.8;
/** Hot air is carried away by convection with this time constant (sim s). */
const AIR_RELAX = 40;
/** Flames can't get hotter than this in air. */
const FLAME_T = 1500;
/** Convective film coefficients, W/(m²·K): liquid contact (incl. boiling) and gas contact. */
const H_LIQUID = 1500;
const H_GAS = 15;

export class MaterialField {
  readonly n: number;
  mat: Uint8Array;
  T: Float32Array;
  /** Latent heat stored toward the next phase change (J/kg; negative = toward freezing/condensing). */
  latent: Float32Array;
  /** Remaining lifetime (gas/fire, real s) or burn time (burning solids, sim s). */
  life: Float32Array;
  shade: Uint8Array;
  P: Float32Array;
  /** Beam power absorbed per cell, W (set by the optics trace). */
  beamPower: Float32Array;
  private beamNext: Float32Array;
  private moved: Uint8Array;
  private Tn: Float32Array;
  private Pn: Float32Array;

  ambient = AMBIENT;
  /** Sim seconds of heat physics per real second. */
  timeScale = 30;
  tick = 0;
  /** Set when cells moved/changed (optics must re-trace). */
  changed = true;
  explosions = 0;

  constructor(
    public cols: number,
    public rows: number,
    /** Metres per cell. */
    public dx = 0.05,
  ) {
    this.n = cols * rows;
    this.mat = new Uint8Array(this.n);
    this.T = new Float32Array(this.n).fill(AMBIENT);
    this.latent = new Float32Array(this.n);
    this.life = new Float32Array(this.n);
    this.shade = new Uint8Array(this.n);
    this.P = new Float32Array(this.n);
    this.beamPower = new Float32Array(this.n);
    this.beamNext = new Float32Array(this.n);
    this.moved = new Uint8Array(this.n);
    this.Tn = new Float32Array(this.n);
    this.Pn = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) this.shade[i] = (Math.random() * 255) | 0;
  }

  // ------------------------------------------------------------------ editing

  set(i: number, m: number, T?: number): void {
    this.mat[i] = m;
    this.T[i] = T ?? SPAWN_T[m];
    this.latent[i] = 0;
    this.life[i] = LIFETIME[m] * (0.6 + Math.random() * 0.8);
    this.shade[i] = (Math.random() * 255) | 0;
    this.changed = true;
  }

  /** Apply `fn` to every cell within radius r (cells) of (cx, cy). */
  brush(cx: number, cy: number, r: number, fn: (i: number) => void): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.cols - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.rows - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) fn(y * this.cols + x);
  }

  paint(cx: number, cy: number, r: number, m: number, density = 1): void {
    this.brush(cx, cy, r, (i) => {
      if (m === AIR || Math.random() < density) this.set(i, m);
    });
  }

  addHeat(cx: number, cy: number, r: number, dT: number): void {
    this.brush(cx, cy, r, (i) => {
      this.T[i] = Math.max(1, this.T[i] + dT);
    });
  }

  /** A blast of `energy` joules centred on a cell. */
  explode(cx: number, cy: number, energy: number): void {
    const i = Math.round(cy) * this.cols + Math.round(cx);
    if (i < 0 || i >= this.n) return;
    const V = this.dx ** 3;
    this.P[i] += energy / V;
    const r = Math.max(2, Math.cbrt(energy / 1e6) * 3);
    this.brush(cx, cy, r, (j) => {
      if (PH[this.mat[j]] === EMPTY || PH[this.mat[j]] === GAS) this.set(j, FIRE_M, 2500);
      else this.T[j] += 800;
    });
    this.explosions++;
  }

  /** Optics adds absorbed beam power here; `commitBeams` makes it current. */
  depositBeam(i: number, watts: number): void {
    this.beamNext[i] += watts;
  }

  commitBeams(): void {
    const t = this.beamPower;
    this.beamPower = this.beamNext;
    this.beamNext = t;
    this.beamNext.fill(0);
  }

  // ------------------------------------------------------------------ update

  update(dtReal: number): void {
    if (dtReal <= 0) return;
    const simDt = dtReal * this.timeScale;
    this.tick++;
    this.moved.fill(0);
    this.motion();
    this.states(dtReal, simDt);
    this.conduct(simDt);
    this.pressure(dtReal);
  }

  private swap(a: number, b: number): void {
    const { mat, T, latent, life, shade, P } = this;
    let t: number = mat[a];
    mat[a] = mat[b];
    mat[b] = t;
    t = T[a];
    T[a] = T[b];
    T[b] = t;
    t = latent[a];
    latent[a] = latent[b];
    latent[b] = t;
    t = life[a];
    life[a] = life[b];
    life[b] = t;
    t = shade[a];
    shade[a] = shade[b];
    shade[b] = t;
    t = P[a];
    P[a] = P[b];
    P[b] = t;
    this.moved[a] = 1;
    this.moved[b] = 1;
    this.changed = true;
  }

  /** Can material m move into the cell holding `other` (falling/sinking)? */
  private canSink(m: number, other: number): boolean {
    const po = PH[other];
    if (po === EMPTY || po === GAS || po === FIRE) return true;
    return po === LIQUID && DENS[m] > DENS[other];
  }

  private motion(): void {
    const { cols, rows, mat, moved } = this;
    for (let y = rows - 1; y >= 0; y--) {
      const ltr = ((this.tick + y) & 1) === 0;
      for (let k = 0; k < cols; k++) {
        const x = ltr ? k : cols - 1 - k;
        const i = y * cols + x;
        if (moved[i]) continue;
        const m = mat[i];
        const ph = PH[m];
        if (ph === POWDER || ph === LIQUID) {
          if (y + 1 < rows) {
            const b = i + cols;
            if (!moved[b] && this.canSink(m, mat[b])) {
              this.swap(i, b);
              continue;
            }
            const d = Math.random() < 0.5 ? 1 : -1;
            let done = false;
            for (const s of [d, -d]) {
              const nx = x + s;
              if (nx < 0 || nx >= cols) continue;
              const j = b + s;
              if (!moved[j] && this.canSink(m, mat[j]) && (ph === LIQUID || PH[mat[i + s]] !== SOLID)) {
                this.swap(i, j);
                done = true;
                break;
              }
            }
            if (done) continue;
          }
          if (ph === LIQUID) {
            // Spread sideways up to FLOW cells (viscosity).
            const d = Math.random() < 0.5 ? 1 : -1;
            const reach = FLOW[m];
            for (const s of [d, -d]) {
              let target = -1;
              for (let step = 1; step <= reach; step++) {
                const nx = x + s * step;
                if (nx < 0 || nx >= cols) break;
                const j = i + s * step;
                const pj = PH[mat[j]];
                if (pj === EMPTY || pj === GAS || pj === FIRE) target = j;
                else break;
              }
              if (target >= 0 && !moved[target]) {
                this.swap(i, target);
                break;
              }
            }
          }
        } else if (ph === GAS || ph === FIRE) {
          // Buoyant gases rise; everything drifts.
          const lighter = DENS[m] < DENS[AIR];
          if (y > 0 && lighter && Math.random() < (ph === FIRE ? 0.8 : 0.55)) {
            const a = i - cols;
            if (!moved[a] && PH[mat[a]] === EMPTY) {
              this.swap(i, a);
              continue;
            }
          }
          const s = Math.random() < 0.5 ? 1 : -1;
          const nx = x + s;
          if (nx >= 0 && nx < cols) {
            const j = i + s;
            if (!moved[j] && PH[mat[j]] === EMPTY && Math.random() < 0.5) this.swap(i, j);
          }
        }
      }
    }
  }

  private hasAirNeighbour(i: number): number {
    const { cols, mat } = this;
    const x = i % cols;
    let air = -1;
    const check = (j: number) => {
      const p = PH[mat[j]];
      if (p === EMPTY || p === GAS || p === FIRE) air = j;
    };
    if (x > 0) check(i - 1);
    if (x < cols - 1) check(i + 1);
    if (i >= cols) check(i - cols);
    if (i + cols < this.n) check(i + cols);
    return air;
  }

  private states(dtReal: number, simDt: number): void {
    const { mat, T, latent, life } = this;
    for (let i = 0; i < this.n; i++) {
      const m = mat[i];
      if (m === AIR) continue;
      const ph = PH[m];

      // Short-lived gases and flames.
      if (LIFETIME[m] > 0) {
        life[i] -= dtReal;
        if (ph === FIRE) T[i] = Math.max(T[i], 900 + 400 * Math.random());
        if (life[i] <= 0) {
          const d = DECAY[m];
          this.set(i, d < 0 ? AIR : d, d === SMOKE_M ? Math.min(T[i], 600) : T[i]);
          continue;
        }
      }

      // Combustion: needs oxygen (an open neighbour).
      const burn = BURN[m];
      if (burn) {
        if (life[i] > 0) {
          const air = this.hasAirNeighbour(i);
          if (air < 0) {
            life[i] = 0; // smothered
          } else {
            const mass = DENS[m] * this.dx ** 3;
            const power = (burn.heat * mass) / burn.burnTime;
            T[i] = Math.min(FLAME_T, T[i] + (power * simDt) / (mass * CP[m]));
            if (Math.random() < 0.35 && PH[mat[air]] === EMPTY) this.set(air, FIRE_M);
            life[i] -= simDt;
            if (life[i] <= 0) {
              this.set(i, burn.ashIdx, T[i] * 0.6);
              continue;
            }
          }
        } else if (T[i] >= burn.at && this.hasAirNeighbour(i) >= 0) {
          life[i] = burn.burnTime * (0.7 + Math.random() * 0.6);
        }
      }

      // Detonation.
      const ex = EXPLOSIVE[m];
      if (ex && T[i] >= ex.at) {
        const x = i % this.cols;
        const y = (i / this.cols) | 0;
        const energy = ex.energy * DENS[m] * this.dx ** 3;
        this.set(i, FIRE_M, 3000);
        this.explode(x, y, energy);
        continue;
      }

      // Phase changes with latent heat.
      if (this.transition(i, m, MELT[m], 1)) continue;
      if (this.transition(i, m, BOIL[m], 1)) continue;
      if (this.transition(i, m, FREEZE[m], -1)) continue;
      if (this.transition(i, m, CONDENSE[m], -1)) continue;
      if (latent[i] !== 0 && !MELT[m] && !BOIL[m] && !FREEZE[m] && !CONDENSE[m]) latent[i] = 0;
    }
  }

  /**
   * dir = +1: heating past `t.at` (melt/boil); −1: cooling below (freeze/condense).
   * Excess heat is banked as latent heat until the full latent heat is paid.
   */
  private transition(i: number, m: number, t: Tr | null, dir: 1 | -1): boolean {
    if (!t) return false;
    const { T, latent } = this;
    const past = dir > 0 ? T[i] > t.at : T[i] < t.at;
    if (!past && latent[i] * dir <= 0) return false;
    if (past) {
      latent[i] += (T[i] - t.at) * CP[m];
      T[i] = t.at;
    }
    if (latent[i] * dir >= t.latent) {
      const excess = latent[i] - dir * t.latent;
      const to = t.to;
      this.mat[i] = to;
      this.latent[i] = 0;
      this.T[i] = t.at + excess / CP[to];
      this.life[i] = LIFETIME[to] * (0.6 + Math.random() * 0.8);
      this.changed = true;
      // Flash boiling: liquid → gas expands ~1000× and pushes on its surroundings.
      if (to === STEAM_M || PH[to] === GAS) this.P[i] += 2e6;
      return true;
    }
    // Re-crossed back before finishing: give the banked heat back.
    if (!past && latent[i] * dir > 0) {
      T[i] += latent[i] / CP[m];
      latent[i] = 0;
    }
    return false;
  }

  private conduct(simDt: number): void {
    const { cols, rows, mat, T, Tn, dx, beamPower } = this;
    const dx2 = dx * dx;
    const relax = 1 - Math.exp(-simDt / AIR_RELAX);
    Tn.set(T);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const mi = mat[i];
        if (x + 1 < cols) this.exchange(i, i + 1, mi, mat[i + 1], simDt, dx, dx2);
        if (y + 1 < rows) this.exchange(i, i + cols, mi, mat[i + cols], simDt, dx, dx2);
      }
    }
    T.set(Tn);
    // Radiation from hot exposed surfaces, beam heating, and convective air cooling.
    const amb4 = this.ambient ** 4;
    for (let i = 0; i < this.n; i++) {
      const m = mat[i];
      const ph = PH[m];
      if (ph === EMPTY) {
        T[i] += (this.ambient - T[i]) * relax;
        continue;
      }
      if (beamPower[i] > 0) T[i] += (beamPower[i] * simDt) / (DENS[m] * CP[m] * dx2 * dx);
      if (T[i] > 500 && ph !== GAS && ph !== FIRE) {
        const faces = this.exposedFaces(i);
        if (faces) T[i] -= (EMISSIVITY * SIGMA_SB * (T[i] ** 4 - amb4) * faces * simDt) / (DENS[m] * CP[m] * dx);
      }
      if (ph === GAS) T[i] += (this.ambient - T[i]) * relax * 0.5;
      if (T[i] < 1) T[i] = 1;
    }
  }

  /**
   * Heat flow between neighbouring cells. Conductance is conduction through
   * both half-cells, or a convective film coefficient where a liquid or gas
   * touches something (that's what makes lava boil water on contact). A flux
   * limiter keeps the explicit step stable for any time step.
   */
  private exchange(i: number, j: number, mi: number, mj: number, dt: number, dx: number, dx2: number): void {
    const pi = PH[mi];
    const pj = PH[mj];
    if (pi === EMPTY && pj === EMPTY) return;
    const { T, Tn } = this;
    const dT = T[j] - T[i];
    if (dT === 0) return;
    const ki = K[mi];
    const kj = K[mj];
    let G = (2 * ki * kj) / (ki + kj) / dx;
    if (pi === LIQUID || pj === LIQUID) G = Math.max(G, H_LIQUID);
    else if (pi !== SOLID || pj !== SOLID) G = Math.max(G, H_GAS);
    const Ci = DENS[mi] * CP[mi] * dx2;
    const Cj = DENS[mj] * CP[mj] * dx2;
    let q = G * dx * dT * dt;
    const qMax = 0.25 * Math.abs(dT) * Math.min(Ci, Cj);
    if (Math.abs(q) > qMax) q = Math.sign(q) * qMax;
    Tn[i] += q / Ci;
    Tn[j] -= q / Cj;
  }

  private exposedFaces(i: number): number {
    const { cols, mat } = this;
    const x = i % cols;
    let f = 0;
    if (x > 0 && PH[mat[i - 1]] === EMPTY) f++;
    if (x < cols - 1 && PH[mat[i + 1]] === EMPTY) f++;
    if (i >= cols && PH[mat[i - cols]] === EMPTY) f++;
    if (i + cols < this.n && PH[mat[i + cols]] === EMPTY) f++;
    return f;
  }

  private pressure(dtReal: number): void {
    const { cols, rows, mat, P, Pn } = this;
    let any = false;
    for (let i = 0; i < this.n; i++)
      if (P[i] > 1e3) {
        any = true;
        break;
      }
    if (!any) return;
    const decay = Math.exp(-dtReal * 4);
    for (let iter = 0; iter < 4; iter++) {
      Pn.set(P);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (PH[mat[i]] === SOLID) continue;
          // Pressure equalises with open neighbours (solids block it).
          let sum = P[i];
          let cnt = 1;
          if (x > 0 && PH[mat[i - 1]] !== SOLID) (sum += P[i - 1]), cnt++;
          if (x < cols - 1 && PH[mat[i + 1]] !== SOLID) (sum += P[i + 1]), cnt++;
          if (y > 0 && PH[mat[i - cols]] !== SOLID) (sum += P[i - cols]), cnt++;
          if (y < rows - 1 && PH[mat[i + cols]] !== SOLID) (sum += P[i + cols]), cnt++;
          Pn[i] = sum / cnt;
        }
      }
      P.set(Pn);
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const m = mat[i];
        const ph = PH[m];
        if (ph === SOLID) {
          // A solid breaks if the pressure beside it beats its strength.
          const br = BREAKS[m];
          if (br) {
            let pmax = 0;
            if (x > 0) pmax = Math.max(pmax, P[i - 1]);
            if (x < cols - 1) pmax = Math.max(pmax, P[i + 1]);
            if (y > 0) pmax = Math.max(pmax, P[i - cols]);
            if (y < rows - 1) pmax = Math.max(pmax, P[i + cols]);
            if (pmax > br.strength) {
              // Shattered: it is now loose debris and the blast flows through it.
              this.set(i, br.to, this.T[i]);
              P[i] = pmax * 0.5;
              continue;
            }
          }
          P[i] = 0;
          continue;
        }
        // Loose material is blown down the pressure gradient.
        if ((ph === POWDER || ph === LIQUID || ph === GAS || ph === FIRE) && P[i] > 2e5) {
          const gx = (x < cols - 1 ? P[i + 1] : P[i]) - (x > 0 ? P[i - 1] : P[i]);
          const gy = (y < rows - 1 ? P[i + cols] : P[i]) - (y > 0 ? P[i - cols] : P[i]);
          const sx = Math.abs(gx) > Math.abs(gy) ? -Math.sign(gx) : 0;
          const sy = sx === 0 ? -Math.sign(gy) : 0;
          const nx = x + sx;
          const ny = y + sy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            const j = ny * cols + nx;
            const pj = PH[mat[j]];
            if (pj === EMPTY || pj === GAS || pj === FIRE) this.swap(i, j);
          }
        }
        P[i] *= decay;
      }
    }
  }

  // ------------------------------------------------------------------ queries

  materialAt(i: number): number {
    return this.mat[i];
  }

  phaseOf(m: number): number {
    return PH[m];
  }

  /** Hottest temperature in the field (for HUD/info). */
  maxTemperature(): number {
    let t = 0;
    for (let i = 0; i < this.n; i++) if (this.mat[i] !== AIR && this.T[i] > t) t = this.T[i];
    return t;
  }

  // ------------------------------------------------------------------ persistence

  /** Run-length encoded materials (temperatures restart from each material's spawn temperature). */
  serialize(): string {
    const out: number[] = [];
    let i = 0;
    while (i < this.n) {
      const m = this.mat[i];
      let run = 1;
      while (i + run < this.n && this.mat[i + run] === m && run < 65535) run++;
      out.push(run & 255, run >> 8, m);
      i += run;
    }
    let s = '';
    const bytes = new Uint8Array(out);
    for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
    return `${this.cols}x${this.rows}:${btoa(s)}`;
  }

  deserialize(data: string): void {
    const [dims, b64] = data.split(':');
    if (!b64) return;
    const [c, r] = dims.split('x').map(Number);
    let bin: string;
    try {
      bin = atob(b64);
    } catch {
      return;
    }
    // Decode into the saved grid size, then copy the overlap into ours.
    const saved = new Uint8Array(c * r);
    let p = 0;
    for (let k = 0; k + 2 < bin.length + 1 && p < saved.length; k += 3) {
      const run = bin.charCodeAt(k) | (bin.charCodeAt(k + 1) << 8);
      saved.fill(bin.charCodeAt(k + 2), p, p + run);
      p += run;
    }
    for (let y = 0; y < Math.min(r, this.rows); y++) {
      for (let x = 0; x < Math.min(c, this.cols); x++) {
        const m = saved[y * c + x];
        if (m < NM && m !== AIR) this.set(y * this.cols + x, m);
      }
    }
  }
}

export { PH as PHASE_OF, EMPTY as PHASE_EMPTY, SOLID as PHASE_SOLID, GAS as PHASE_GAS, FIRE as PHASE_FIRE };
