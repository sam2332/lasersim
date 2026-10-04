import { Sun, Rainbow } from 'lucide';
import { rad, rotate } from '../core/math';
import type { ElementDef, Emission, Signals } from '../core/types';
import { absorber } from '../optics/materials';
import { rectSurfaces } from '../optics/shapes';
import { beamColor, spectrumSamples } from '../optics/spectrum';
import { bodyGradient, metalGradient } from '../render/style';
import { graphicsView } from '../render/viewkit';

interface RainbowProps {
  beams: number;
  /** Gap between parallel beams; 0 makes one white beam. */
  spacing: number;
  /** Fan-out angle in degrees across all beams. */
  spread: number;
  on: boolean;
}

const W = 58;
const isOn = (p: RainbowProps, sig: Signals) => p.on && (!sig.wired.en || !!sig.inputs.en);
const bodyH = (p: RainbowProps) => Math.max(24, (p.beams - 1) * p.spacing + 16);

/** Spectrum emitter: parallel beams across the rainbow, or (spacing 0) a single white beam. */
const rainbow: ElementDef<RainbowProps> = {
  type: 'rainbow',
  label: 'Rainbow emitter',
  icon: Rainbow,
  category: 'source',
  order: 1,
  description: 'Several beams across the spectrum. Set spacing to 0 for white light that a prism can split.',
  variants: [
    { label: 'Rainbow emitter', icon: Rainbow, props: { beams: 7, spacing: 6 } },
    { label: 'White light', icon: Sun, props: { beams: 12, spacing: 0 } },
  ],
  defaults: () => ({ beams: 7, spacing: 6, spread: 0, on: true }),
  normalize: (p) => ({ ...p, beams: Math.round(Math.min(16, Math.max(2, p.beams))), spacing: Math.max(0, p.spacing) }),
  params: [
    { kind: 'number', key: 'beams', label: 'Beams', min: 2, max: 16, step: 1 },
    { kind: 'number', key: 'spacing', label: 'Spacing', min: 0, max: 14, step: 0.5 },
    { kind: 'number', key: 'spread', label: 'Fan angle', min: 0, max: 60, step: 1 },
    { kind: 'boolean', key: 'on', label: 'On' },
  ],
  activate: (p) => ({ on: !p.on }),
  ports: () => [{ id: 'en', dir: 'in', position: { x: -W / 2 - 9, y: 0 }, label: 'enable' }],

  boundsRadius: (p) => Math.hypot(W / 2, bodyH(p) / 2),
  hitTest: (p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= bodyH(p) / 2 + 2,
  surfaces: (p) => rectSurfaces(W, bodyH(p), absorber),
  emit: (p, sig) => {
    if (!isOn(p, sig)) return [];
    const waves = spectrumSamples(p.beams);
    const white = p.spacing === 0;
    return waves.map((wavelength, i): Emission => {
      const t = p.beams > 1 ? i / (p.beams - 1) - 0.5 : 0;
      return {
        origin: { x: W / 2 + 0.5, y: t * (p.beams - 1) * p.spacing },
        dir: rotate({ x: 1, y: 0 }, rad(p.spread) * t),
        wavelength,
        intensity: white ? 0.75 : 1,
      };
    });
  },

  createView: () =>
    graphicsView<RainbowProps>((g, p, state) => {
      const on = isOn(p, state.signals);
      const h = bodyH(p);
      const white = p.spacing === 0;
      g.roundRect(-W / 2 + 3, -h / 2 + 5, W, h, 6).fill({ color: 0x000000, alpha: 0.4 });
      g.roundRect(-W / 2, -h / 2, W - 10, h, 6).fill({ fill: bodyGradient() }).stroke({ width: 1, color: 0x5b6476 });
      // Dotted grille like a projector head.
      for (let y = -h / 2 + 6; y <= h / 2 - 6; y += 5) for (let x = -W / 2 + 7; x < 0; x += 5) g.circle(x, y, 1).fill({ color: 0x000000, alpha: 0.6 });
      // Colour strip.
      const waves = spectrumSamples(p.beams);
      const stripH = h - 6;
      waves.forEach((w, i) => {
        g.rect(W / 2 - 22, -stripH / 2 + (i * stripH) / waves.length, 6, stripH / waves.length + 0.5).fill({
          color: white ? 0xffffff : beamColor(w),
          alpha: on ? 0.95 : 0.3,
        });
      });
      g.roundRect(W / 2 - 12, -h / 2 + 2, 12, h - 4, 2).fill({ fill: metalGradient() });
      g.rect(W / 2 - 2, -h / 2 + 4, 2, h - 8).fill(on ? 0xffffff : 0x333a46);
      g.circle(-W / 2 + 6, -h / 2 + 5, 2).fill(on ? 0x6dff9c : 0x3a2020);
    }),
};

export default rainbow;
