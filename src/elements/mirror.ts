import { FlipHorizontal2 } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { mirror as mirrorMaterial } from '../optics/materials';
import { metalGradient } from '../render/style';
import { graphicsView } from '../render/viewkit';

interface MirrorProps {
  length: number;
  reflectivity: number;
}

const T = 8;

/** Flat double-sided mirror. */
const mirror: ElementDef<MirrorProps> = {
  type: 'mirror',
  label: 'Mirror',
  icon: FlipHorizontal2,
  category: 'optic',
  order: 0,
  description: 'Flat mirror, reflective on both sides. Drag the end handles to resize.',
  defaults: () => ({ length: 140, reflectivity: 0.97 }),
  normalize: (p) => ({ ...p, length: clamp(p.length, 20, 800) }),
  params: [
    { kind: 'number', key: 'length', label: 'Length', min: 20, max: 800, step: 1 },
    { kind: 'number', key: 'reflectivity', label: 'Reflectivity', min: 0.1, max: 1, step: 0.01 },
  ],

  boundsRadius: (p) => p.length / 2 + 2,
  hitTest: (p, l) => Math.abs(l.x) <= T / 2 + 4 && Math.abs(l.y) <= p.length / 2 + 2,
  handles: (p) => [
    { id: 'end-a', position: { x: 0, y: p.length / 2 }, drag: (_p, l) => ({ length: Math.abs(l.y) * 2 }) },
    { id: 'end-b', position: { x: 0, y: -p.length / 2 }, drag: (_p, l) => ({ length: Math.abs(l.y) * 2 }) },
  ],
  surfaces: (p) => [
    { kind: 'segment', a: { x: 0, y: -p.length / 2 }, b: { x: 0, y: p.length / 2 }, material: mirrorMaterial(p.reflectivity) },
  ],

  createView: () =>
    graphicsView<MirrorProps>((g, p) => {
      const L = p.length;
      g.roundRect(-T / 2 + 3, -L / 2 + 5, T, L, 3).fill({ color: 0x000000, alpha: 0.4 });
      g.roundRect(-T / 2, -L / 2, T, L, 3).fill({ fill: metalGradient() }).stroke({ width: 1, color: 0x1d2129, alpha: 0.9 });
      g.moveTo(0, -L / 2 + 2).lineTo(0, L / 2 - 2).stroke({ width: 1.2, color: 0xffffff, alpha: 0.95 });
      g.roundRect(-T / 2 - 1, -L / 2 - 1, T + 2, 5, 2).fill(0x2a2f39);
      g.roundRect(-T / 2 - 1, L / 2 - 4, T + 2, 5, 2).fill(0x2a2f39);
    }),
};

export default mirror;
