import { Sprite } from 'pixi.js';
import { Zap } from 'lucide';
import type { ElementDef } from '../core/types';
import { absorber } from '../optics/materials';
import { rectSurfaces } from '../optics/shapes';
import { beamColor } from '../optics/spectrum';
import { bodyGradient, metalGradient } from '../render/style';
import { graphicsView } from '../render/viewkit';

interface LaserProps {
  wavelength: number;
  power: number;
  on: boolean;
}

const W = 64;
const H = 22;

/** Single-colour laser. */
const laser: ElementDef<LaserProps> = {
  type: 'laser',
  label: 'Laser',
  icon: Zap,
  category: 'source',
  order: 0,
  description: 'A single-colour beam. Double-click or press Space to toggle.',
  variants: [
    { label: 'Red laser', props: { wavelength: 650 } },
    { label: 'Green laser', props: { wavelength: 532 } },
    { label: 'Blue laser', props: { wavelength: 450 } },
  ],
  defaults: () => ({ wavelength: 650, power: 1, on: true }),
  params: [
    { kind: 'wavelength', key: 'wavelength', label: 'Colour' },
    { kind: 'number', key: 'power', label: 'Power', min: 0.1, max: 1, step: 0.05 },
    { kind: 'boolean', key: 'on', label: 'On' },
  ],
  activate: (p) => ({ on: !p.on }),

  boundsRadius: () => W / 2 + 2,
  hitTest: (_p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= H / 2 + 3,
  surfaces: () => rectSurfaces(W, H, absorber),
  emit: (p) => (p.on ? [{ origin: { x: W / 2 + 0.5, y: 0 }, dir: { x: 1, y: 0 }, wavelength: p.wavelength, intensity: p.power }] : []),

  createView: ({ textures }) => {
    let flare: Sprite;
    return graphicsView<LaserProps>(
      (g, p) => {
        const color = beamColor(p.wavelength);
        g.roundRect(-W / 2 + 3, -H / 2 + 5, W, H, 6).fill({ color: 0x000000, alpha: 0.4 });
        g.roundRect(-W / 2, -H / 2, W - 8, H, 6).fill({ fill: bodyGradient() }).stroke({ width: 1, color: 0x5b6476 });
        for (let i = 0; i < 5; i++) g.rect(-W / 2 + 7 + i * 5, -H / 2 + 4, 2, H - 8).fill({ color: 0x000000, alpha: 0.45 });
        g.rect(W / 2 - 22, -H / 2, 5, H).fill({ color, alpha: p.on ? 0.95 : 0.35 });
        g.roundRect(W / 2 - 10, -7, 10, 14, 2).fill({ fill: metalGradient() });
        g.circle(W / 2 - 1, 0, 3).fill(p.on ? 0xffffff : 0x333a46);
        g.circle(-W / 2 + 7, -H / 2 + 5, 2).fill(p.on ? 0x6dff9c : 0x3a2020);
      },
      {
        setup: (root) => {
          flare = new Sprite(textures.glow);
          flare.anchor.set(0.5);
          flare.blendMode = 'add';
          flare.position.set(W / 2, 0);
          root.addChild(flare);
        },
        update: (el) => {
          flare.visible = el.props.on;
          flare.tint = beamColor(el.props.wavelength);
          flare.scale.set((40 * el.props.power) / 256);
        },
      },
    );
  },
};

export default laser;
