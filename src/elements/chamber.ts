import { Graphics, Particle, ParticleContainer, type Texture } from 'pixi.js';
import { Container as ContainerIcon } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef, Port, Surface } from '../core/types';
import { lead, led, makeLabel } from '../kit/device';
import { absorber } from '../optics/materials';
import { rectSurfaces } from '../optics/shapes';
import { SPECIES_MASS, SPECIES_RADIUS } from '../particles/sim';
import { SPECIES, speciesIndex } from '../particles/species';
import { particleWorld, WALL, type ChamberProps, type FillSpec } from '../particles/world';
import { metalGradient } from '../render/style';
import { graphicsView } from '../render/viewkit';

interface Props extends ChamberProps {
  walls: 'steel' | 'glass';
  colorMode: 'species' | 'speed';
  /** Over-pressure output threshold, atm. */
  pLimit: number;
  /** Over-temperature output threshold, K. */
  tLimit: number;
}

/** Approximate blackbody colour for a temperature in K (flame / ember colours). */
function blackbody(T: number): number {
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v: number) => Math.round(clamp(v, 0, 255));
  return (c(r) << 16) | (c(g) << 8) | c(b);
}

/** Map speed relative to the thermal speed onto a blue → white → red ramp. */
function speedColor(v: number): number {
  const t = clamp(v / 2.2, 0, 1);
  const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
  const [r, g, b] = t < 0.5 ? [lerp(40, 235, t * 2), lerp(110, 240, t * 2), lerp(255, 255, t * 2)] : [lerp(235, 255, (t - 0.5) * 2), lerp(240, 70, (t - 0.5) * 2), lerp(255, 40, (t - 0.5) * 2)];
  return (r << 16) | (g << 8) | b;
}

const portsFor = (p: Props): Port[] => [
  { id: 'heat', dir: 'in', position: { x: -p.width / 2 - 14, y: -36 }, normal: { x: -1, y: 0 }, label: 'heater' },
  { id: 'vent', dir: 'in', position: { x: -p.width / 2 - 14, y: -12 }, normal: { x: -1, y: 0 }, label: 'vent' },
  { id: 'inlet', dir: 'in', position: { x: -p.width / 2 - 14, y: 12 }, normal: { x: -1, y: 0 }, label: 'gas inlet' },
  { id: 'piston', dir: 'in', position: { x: -p.width / 2 - 14, y: 36 }, normal: { x: -1, y: 0 }, label: 'piston' },
  { id: 'ignite', dir: 'in', position: { x: -p.width / 2 - 14, y: 60 }, normal: { x: -1, y: 0 }, label: 'spark plug (fires on rising edge)' },
  { id: 'overP', dir: 'out', position: { x: p.width / 2 + 14, y: -14 }, normal: { x: 1, y: 0 }, label: 'pressure > limit' },
  { id: 'hot', dir: 'out', position: { x: p.width / 2 + 14, y: 14 }, normal: { x: 1, y: 0 }, label: 'temperature > limit' },
];

/**
 * Resizable containment chamber full of simulated molecules (2D Lennard-Jones
 * molecular dynamics). Gases, liquids and solids emerge from the physics.
 */
const chamber: ElementDef<Props> = {
  type: 'chamber',
  label: 'Particle chamber',
  icon: ContainerIcon,
  category: 'matter',
  order: 0,
  description:
    'A box of simulated molecules. Pick a species and use the particle tools (top of the board) to spawn, erase, heat, cool or push. Pressure, temperature, condensation and evaporation come from real intermolecular forces.',
  variants: [
    { label: 'Empty chamber (vacuum)', props: {} },
    { label: 'Argon chamber', props: { fill: [{ species: 'ar', count: 300, T: 293 }] } },
    { label: 'Glass chamber', props: { walls: 'glass', fill: [{ species: 'n2', count: 200, T: 293 }] } },
    { label: 'Piston cylinder', props: { piston: true, pistonPos: 1, thermal: 0, fill: [{ species: 'ar', count: 250, T: 293 }] } },
  ],
  defaults: () => ({
    width: 560,
    height: 360,
    walls: 'steel',
    wallTemp: 293,
    thermal: 0.6,
    thermostat: false,
    gravity: 0,
    heaterTemp: 700,
    piston: false,
    pistonPos: 0.5,
    inletSpecies: 'n2',
    inletRate: 40,
    inletT: 293,
    chemistry: true,
    barrierScale: 0.25,
    plugX: 0.14,
    plugY: 0.5,
    pLimit: 40,
    tLimit: 400,
    colorMode: 'species',
    fill: [] as FillSpec[],
    particles: '',
  }),
  normalize: (p) => ({
    ...p,
    width: clamp(p.width, 80, 1700),
    height: clamp(p.height, 80, 1060),
    wallTemp: clamp(p.wallTemp, 1, 5000),
    heaterTemp: clamp(p.heaterTemp, 1, 5000),
    thermal: clamp(p.thermal, 0, 1),
    pistonPos: clamp(p.pistonPos ?? 0.5, 0.1, 1),
    inletRate: clamp(p.inletRate ?? 40, 0, 2000),
    fill: Array.isArray(p.fill) ? p.fill : [],
    particles: typeof p.particles === 'string' ? p.particles : '',
  }),
  params: [
    { kind: 'action', label: 'Empty chamber (vacuum)', event: 'clear-chamber' },
    { kind: 'number', key: 'wallTemp', label: 'Wall temperature (K)', min: 1, max: 2000, step: 1 },
    { kind: 'number', key: 'thermal', label: 'Wall heat contact', min: 0, max: 1, step: 0.05 },
    { kind: 'boolean', key: 'thermostat', label: 'Thermostat (hold at wall T)' },
    { kind: 'number', key: 'heaterTemp', label: 'Heater temperature (K)', min: 1, max: 3000, step: 1 },
    { kind: 'number', key: 'gravity', label: 'Gravity (exaggerated)', min: 0, max: 0.5, step: 0.005 },
    { kind: 'boolean', key: 'piston', label: 'Piston (right wall)' },
    { kind: 'number', key: 'pistonPos', label: 'Piston position', min: 0.1, max: 1, step: 0.01 },
    { kind: 'select', key: 'inletSpecies', label: 'Inlet gas', options: Object.fromEntries(SPECIES.map((sp) => [`${sp.formula} · ${sp.name}`, sp.id])) },
    { kind: 'number', key: 'inletRate', label: 'Inlet rate (/s)', min: 0, max: 500, step: 1 },
    { kind: 'number', key: 'inletT', label: 'Inlet temperature (K)', min: 1, max: 3000, step: 1 },
    { kind: 'select', key: 'walls', label: 'Walls', options: { 'Steel (opaque)': 'steel', 'Glass (light passes)': 'glass' } },
    { kind: 'select', key: 'colorMode', label: 'Colour by', options: { Species: 'species', 'Speed (thermal)': 'speed' } },
    { kind: 'boolean', key: 'chemistry', label: 'Chemistry (combustion)' },
    { kind: 'select', key: 'barrierScale', label: 'Reaction speed', options: { 'Fast (barriers ×0.25)': 0.25, 'Medium (×0.5)': 0.5, 'Realistic (×1, very slow)': 1 } },
    { kind: 'number', key: 'plugX', label: 'Spark plug X', min: 0.02, max: 0.98, step: 0.01 },
    { kind: 'number', key: 'plugY', label: 'Spark plug Y', min: 0.02, max: 0.98, step: 0.01 },
    { kind: 'number', key: 'pLimit', label: 'Pressure limit (atm)', min: 0, max: 2000, step: 1 },
    { kind: 'number', key: 'tLimit', label: 'Temperature limit (K)', min: 0, max: 5000, step: 1 },
    { kind: 'number', key: 'width', label: 'Width', min: 80, max: 1700, step: 1 },
    { kind: 'number', key: 'height', label: 'Height', min: 80, max: 1060, step: 1 },
  ],
  info: (_p, id) => {
    const s = particleWorld.stats(id);
    const mix = s.counts
      .map((c, i) => (c ? `${SPECIES[i].formula} ${c}` : ''))
      .filter(Boolean)
      .join(', ');
    const sim = particleWorld.get(id);
    return {
      Particles: String(s.n),
      Reactions: sim ? `${sim.reactions} (heat ${(sim.heatReleased / 120.27 / 1000).toFixed(1)} MJ/mol-eq)` : '0',
      Temperature: `${s.temperature.toFixed(1)} K`,
      Pressure: s.n ? `${s.pressureAtm.toFixed(2)} atm` : 'vacuum',
      Contents: mix || '—',
    };
  },
  liveInfo: true,
  rotatable: false,

  boundsRadius: (p) => Math.hypot(p.width, p.height) / 2,
  hitTest: (p, l) => Math.abs(l.x) <= p.width / 2 + 2 && Math.abs(l.y) <= p.height / 2 + 2,
  handles: (p) => [{ id: 'corner', position: { x: p.width / 2, y: p.height / 2 }, drag: (_p, l) => ({ width: Math.abs(l.x) * 2, height: Math.abs(l.y) * 2 }) }],
  ports: portsFor,
  surfaces: (p): Surface[] => (p.walls === 'steel' ? rectSurfaces(p.width, p.height, absorber) : []),
  logic: ({ id, props, inputs, wired, state }) => {
    // Spark plug fires once per rising edge.
    if (inputs.ignite && !state.ignite) particleWorld.spark(id, (props.plugX ?? 0.08) * (props.width - 2 * WALL), (props.plugY ?? 0.5) * (props.height - 2 * WALL));
    state.ignite = !!inputs.ignite;
    particleWorld.setInputs(id, { heat: !!inputs.heat, vent: !!inputs.vent, inlet: !!inputs.inlet, piston: !!inputs.piston, pistonWired: !!wired.piston });
    const s = particleWorld.stats(id);
    return { overP: s.n > 0 && s.pressureAtm > props.pLimit, hot: s.n > 0 && s.temperature > props.tLimit };
  },

  createView: ({ textures }) => {
    const particles = new ParticleContainer({ dynamicProperties: { position: true, color: true } });
    const pistonG = new Graphics();
    let pistonKey = '';
    // Hot molecules glow like a flame (blackbody colour); sparks flash.
    const glows = new ParticleContainer({ dynamicProperties: { position: true, color: true, vertex: true } });
    glows.blendMode = 'add';
    const flash = new Graphics();
    flash.blendMode = 'add';
    let glowPool: Particle[] = [];
    const label = makeLabel(10, 0xaab6cc);
    label.anchor.set(0, 0.5);
    let pool: Particle[] = [];
    let drawn = false;

    const tex: Texture = textures.orb;
    return graphicsView<Props>(
      (g, p, state) => {
        const W = p.width;
        const H = p.height;
        const heating = !!state.signals.inputs.heat;
        const venting = !!state.signals.inputs.vent;
        g.roundRect(-W / 2 + 4, -H / 2 + 6, W, H, 8).fill({ color: 0x000000, alpha: 0.45 });
        if (p.walls === 'steel') {
          g.roundRect(-W / 2, -H / 2, W, H, 8).fill({ fill: metalGradient() });
          g.roundRect(-W / 2, -H / 2, W, H, 8).fill({ color: 0x1a1e26, alpha: 0.55 });
        } else {
          g.roundRect(-W / 2, -H / 2, W, H, 8).fill({ color: 0x9fd8ff, alpha: 0.12 }).stroke({ width: 1.4, color: 0xd9f3ff, alpha: 0.85 });
        }
        // Interior.
        g.rect(-W / 2 + WALL, -H / 2 + WALL, W - 2 * WALL, H - 2 * WALL).fill({ color: 0x04060a, alpha: p.walls === 'steel' ? 1 : 0.55 });
        if (heating) g.rect(-W / 2 + WALL, -H / 2 + WALL, W - 2 * WALL, H - 2 * WALL).stroke({ width: 3, color: 0xff5a2a, alpha: 0.8 });
        // Bolts.
        if (p.walls === 'steel') for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.circle((sx * W) / 2 - sx * 5, (sy * H) / 2 - sy * 5, 2).fill(0x4a5262);
        // Inlet nozzle on the left wall.
        g.rect(-W / 2, -12, WALL, 24).fill(state.signals.inputs.inlet ? 0x1d5b6a : 0x2a303c);
        if (state.signals.inputs.inlet) g.rect(-W / 2 + WALL - 2, -12, 2, 24).fill(SPECIES[speciesIndex(p.inletSpecies)].color);
        // Vent in the middle third of the top wall.
        const vx0 = -W / 2 + WALL + (W - 2 * WALL) / 3;
        g.rect(vx0, -H / 2, (W - 2 * WALL) / 3, WALL).fill(venting ? 0x0b1a10 : 0x2a303c);
        if (venting) g.rect(vx0, -H / 2, (W - 2 * WALL) / 3, 2).fill(0x6dff9c);
        for (const port of portsFor(p)) {
          const on = port.dir === 'in' ? !!state.signals.inputs[port.id] : !!state.signals.outputs[port.id];
          lead(g, Math.sign(port.position.x) * (W / 2), port.position.y, port.position.x, port.position.y, on);
        }
        led(g, W / 2 - 14, -H / 2 + 5, !!state.signals.outputs.overP, 0xff5a5a, 2.2);
        led(g, W / 2 - 24, -H / 2 + 5, !!state.signals.outputs.hot, 0xffb347, 2.2);
        particles.position.set(-W / 2 + WALL, -H / 2 + WALL);
        glows.position.set(-W / 2 + WALL, -H / 2 + WALL);
        flash.position.set(-W / 2 + WALL, -H / 2 + WALL);
        // Spark plug electrodes.
        const px = -W / 2 + WALL + (p.plugX ?? 0.08) * (W - 2 * WALL);
        const py = -H / 2 + WALL + (p.plugY ?? 0.5) * (H - 2 * WALL);
        if (state.signals.wired.ignite) {
          g.rect(-W / 2, py - 2, px - 4 - -W / 2, 4).fill({ fill: metalGradient() });
          g.circle(px - 4, py, 3).fill(0xd8dee9);
          g.circle(px + 4, py, 2).fill(0xd8dee9);
        }
        label.position.set(-W / 2 + 14, -H / 2 + 22);
        drawn = true;
      },
      {
        setup: (root) => root.addChild(particles, glows, flash, pistonG, label),
        tick: (_dt, el) => {
          const sim = particleWorld.get(el.id);
          if (!sim || !drawn) return;
          // Grow/shrink the sprite pool to match the particle count.
          while (pool.length < sim.n) {
            const pt = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 });
            pool.push(pt);
            particles.addParticle(pt);
          }
          if (pool.length > sim.n) {
            particles.removeParticles(sim.n, pool.length);
            pool = pool.slice(0, sim.n);
          }
          const bySpeed = el.props.colorMode === 'speed';
          const T = Math.max(1, sim.temperature());
          for (let i = 0; i < sim.n; i++) {
            const pt = pool[i];
            const s = sim.sp[i];
            pt.x = sim.x[i];
            pt.y = sim.y[i];
            const scale = (SPECIES_RADIUS[s] * 2.1) / 256;
            pt.scaleX = pt.scaleY = scale;
            if (bySpeed) {
              const v = Math.hypot(sim.vx[i], sim.vy[i]) / Math.sqrt((2 * T) / SPECIES_MASS[s]);
              pt.tint = speedColor(v);
            } else {
              pt.tint = SPECIES[s].color;
            }
          }
          particles.update();

          // Flame glow for molecules hotter than ~1200 K (per-molecule kinetic temperature).
          let used = 0;
          for (let i = 0; i < sim.n; i++) {
            const s = sim.sp[i];
            const ti = 0.5 * SPECIES_MASS[s] * (sim.vx[i] ** 2 + sim.vy[i] ** 2);
            const radical = SPECIES[s].radical;
            if (ti < 1200 && !radical) continue;
            let gp = glowPool[used];
            if (!gp) {
              gp = new Particle({ texture: textures.glow, anchorX: 0.5, anchorY: 0.5 });
              glowPool.push(gp);
              glows.addParticle(gp);
            }
            gp.x = sim.x[i];
            gp.y = sim.y[i];
            const heat = Math.min(1, (ti - 1200) / 4000);
            const size = (radical ? 26 : 18 + 30 * heat) / 256;
            gp.scaleX = gp.scaleY = size;
            gp.tint = radical && ti < 1200 ? SPECIES[s].color : blackbody(Math.max(ti, 1200));
            gp.alpha = radical && ti < 1200 ? 0.35 : 0.25 + 0.6 * heat;
            used++;
          }
          if (glowPool.length > used) {
            glows.removeParticles(used, glowPool.length);
            glowPool = glowPool.slice(0, used);
          }
          glows.update();

          // Spark flash: a jagged arc that fades over ~0.3 s of sim time.
          flash.clear();
          const sp = sim.lastSpark;
          const age = sp ? sim.time - sp.time : Infinity;
          if (sp && age < 12) {
            const k = 1 - age / 12;
            for (let arc = 0; arc < 3; arc++) {
              let ax = sp.x;
              let ay = sp.y;
              flash.moveTo(ax, ay);
              const dir = Math.random() * Math.PI * 2;
              for (let seg = 0; seg < 6; seg++) {
                ax += Math.cos(dir + (Math.random() - 0.5) * 1.6) * sp.r * 0.25;
                ay += Math.sin(dir + (Math.random() - 0.5) * 1.6) * sp.r * 0.25;
                flash.lineTo(ax, ay);
              }
            }
            flash.stroke({ width: 2, color: 0xc8e4ff, alpha: k });
            flash.circle(sp.x, sp.y, sp.r * (0.4 + 0.6 * (1 - k))).fill({ color: 0x9fd4ff, alpha: 0.25 * k });
          }
          // Piston plate + rod follow the simulated right wall.
          const W = el.props.width;
          const H = el.props.height;
          const key = el.props.piston ? `${sim.right.toFixed(1)}|${W}|${H}` : '';
          if (key !== pistonKey) {
            pistonKey = key;
            pistonG.clear();
            if (el.props.piston) {
              const x = -W / 2 + WALL + sim.right;
              const back = W / 2 - WALL - (x + 8);
              // Space behind the piston, the plate, then the rod out through the wall.
              if (back > 0) pistonG.rect(x + 8, -H / 2 + WALL, back, H - 2 * WALL).fill({ color: 0x0b0d12, alpha: 0.65 });
              pistonG.rect(x, -H / 2 + WALL, 8, H - 2 * WALL).fill({ fill: metalGradient() }).stroke({ width: 1, color: 0x1d2129 });
              pistonG.rect(x + 8, -9, W / 2 - (x + 8), 18).fill({ fill: metalGradient() });
            }
          }
          const st = particleWorld.stats(el.id);
          label.text = st.n ? `${st.n} · ${st.temperature.toFixed(0)} K · ${st.pressureAtm.toFixed(1)} atm` : 'vacuum';
        },
      },
    );
  },
};

export default chamber;
