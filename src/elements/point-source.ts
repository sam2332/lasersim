import { Sprite } from 'pixi.js';
import { Lightbulb } from 'lucide';
import { clamp, rad, rotate } from '../core/math';
import type { ElementDef, Emission, Signals } from '../core/types';
import { linear } from '../optics/polarization';
import { beamColor, spectrumSamples } from '../optics/spectrum';
import { graphicsView } from '../render/viewkit';

interface PointSourceProps {
  rays: number;
  /** Total fan angle, degrees. */
  fan: number;
  wavelength: number;
  white: boolean;
  power: number;
  /** Linear polarization angle, degrees; -1 = unpolarized. */
  polarization: number;
  on: boolean;
}

const isOn = (p: PointSourceProps, sig: Signals) => p.on && (!sig.wired.en || !!sig.inputs.en);

/** A point emitter (an LED / one display pixel) radiating a fan of rays. */
const pointSource: ElementDef<PointSourceProps> = {
  type: 'point-source',
  label: 'Point source',
  icon: Lightbulb,
  category: 'source',
  order: 2,
  description: 'A point of light (LED or a single display pixel) radiating a fan of rays. Great for seeing how optics focus.',
  defaults: () => ({ rays: 9, fan: 30, wavelength: 560, white: false, power: 1, polarization: -1, on: true }),
  normalize: (p) => ({ ...p, rays: Math.round(clamp(p.rays, 1, 41)), fan: clamp(p.fan, 0, 360) }),
  params: [
    { kind: 'number', key: 'rays', label: 'Rays', min: 1, max: 41, step: 1 },
    { kind: 'number', key: 'fan', label: 'Fan angle°', min: 0, max: 360, step: 1 },
    { kind: 'wavelength', key: 'wavelength', label: 'Colour' },
    { kind: 'boolean', key: 'white', label: 'White light' },
    { kind: 'number', key: 'power', label: 'Power', min: 0.1, max: 4, step: 0.1 },
    { kind: 'number', key: 'polarization', label: 'Polarization° (-1 = none)', min: -1, max: 180, step: 1 },
    { kind: 'boolean', key: 'on', label: 'On' },
  ],
  activate: (p) => ({ on: !p.on }),
  ports: () => [{ id: 'en', dir: 'in', position: { x: -20, y: 0 }, label: 'enable' }],

  boundsRadius: () => 12,
  hitTest: (_p, l) => Math.hypot(l.x, l.y) <= 13,
  emit: (p, sig) => {
    if (!isOn(p, sig)) return [];
    const waves = p.white ? spectrumSamples(7) : [p.wavelength];
    const pol = p.polarization < 0 ? null : linear(rad(p.polarization));
    const out: Emission[] = [];
    const full = p.fan >= 360;
    for (let i = 0; i < p.rays; i++) {
      const t = p.rays === 1 ? 0 : full ? i / p.rays : i / (p.rays - 1) - 0.5;
      const dir = rotate({ x: 1, y: 0 }, rad(p.fan) * t);
      for (const wavelength of waves) {
        out.push({ origin: { x: dir.x * 9, y: dir.y * 9 }, dir, wavelength, intensity: p.power / (p.white ? 2.5 : 1), pol });
      }
    }
    return out;
  },

  createView: ({ textures }) => {
    let glow: Sprite;
    return graphicsView<PointSourceProps>(
      (g, p, state) => {
        const on = isOn(p, state.signals);
        g.circle(2, 3, 10).fill({ color: 0x000000, alpha: 0.4 });
        g.circle(0, 0, 9).fill(0x161a22).stroke({ width: 1.2, color: 0x5b6476 });
        g.circle(0, 0, 5).fill(on ? (p.white ? 0xffffff : beamColor(p.wavelength)) : 0x2a2f39);
        // Fan indicator.
        const half = rad(Math.min(p.fan, 359) / 2);
        g.moveTo(0, 0).arc(0, 0, 12, -half, half).stroke({ width: 1, color: 0x8fb4ff, alpha: 0.35 });
      },
      {
        setup: (root) => {
          glow = new Sprite(textures.glow);
          glow.anchor.set(0.5);
          glow.blendMode = 'add';
          root.addChild(glow);
        },
        update: (el, state) => {
          glow.visible = isOn(el.props, state.signals);
          glow.tint = el.props.white ? 0xffffff : beamColor(el.props.wavelength);
          glow.scale.set(46 / 256);
        },
      },
    );
  },
};

export default pointSource;
