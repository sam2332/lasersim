import { Split } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { splitter as splitterMaterial } from '../optics/materials';
import { graphicsView } from '../render/viewkit';

interface SplitterProps {
  length: number;
  /** Share of light reflected (the rest passes straight through). */
  ratio: number;
}

const T = 5;

const splitter: ElementDef<SplitterProps> = {
  type: 'splitter',
  label: 'Beam splitter',
  icon: Split,
  category: 'optic',
  order: 4,
  description: 'Half-silvered plate: reflects part of the beam and lets the rest through.',
  defaults: () => ({ length: 110, ratio: 0.5 }),
  normalize: (p) => ({ ...p, length: clamp(p.length, 20, 600), ratio: clamp(p.ratio, 0, 1) }),
  params: [
    { kind: 'number', key: 'length', label: 'Length', min: 20, max: 600, step: 1 },
    { kind: 'number', key: 'ratio', label: 'Reflected share', min: 0, max: 1, step: 0.05 },
  ],

  boundsRadius: (p) => p.length / 2 + 2,
  hitTest: (p, l) => Math.abs(l.x) <= T / 2 + 4 && Math.abs(l.y) <= p.length / 2 + 2,
  handles: (p) => [{ id: 'end', position: { x: 0, y: p.length / 2 }, drag: (_p, l) => ({ length: Math.abs(l.y) * 2 }) }],
  surfaces: (p) => [
    { kind: 'segment', a: { x: 0, y: -p.length / 2 }, b: { x: 0, y: p.length / 2 }, material: splitterMaterial(p.ratio) },
  ],

  createView: () =>
    graphicsView<SplitterProps>((g, p) => {
      const L = p.length;
      g.roundRect(-T / 2 + 3, -L / 2 + 5, T, L, 2).fill({ color: 0x000000, alpha: 0.25 });
      g.roundRect(-T / 2, -L / 2, T, L, 2).fill({ color: 0xb8dcff, alpha: 0.18 }).stroke({ width: 1, color: 0xd9f3ff, alpha: 0.8 });
      g.moveTo(0, -L / 2 + 3).lineTo(0, L / 2 - 3).stroke({ width: 1.5, color: 0xe8eef8, alpha: 0.25 + 0.7 * p.ratio });
      g.roundRect(-T / 2 - 1.5, -L / 2 - 2, T + 3, 5, 2).fill(0x2a2f39);
      g.roundRect(-T / 2 - 1.5, L / 2 - 3, T + 3, 5, 2).fill(0x2a2f39);
    }),
};

export default splitter;
