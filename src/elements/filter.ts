import { Contrast } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { bandpass } from '../optics/materials';
import { beamColor } from '../optics/spectrum';
import { graphicsView } from '../render/viewkit';

interface FilterProps {
  length: number;
  /** Centre of the pass band, nm. */
  wavelength: number;
  /** Pass band half-width, nm. */
  width: number;
}

const T = 6;

const filter: ElementDef<FilterProps> = {
  type: 'filter',
  label: 'Colour filter',
  icon: Contrast,
  category: 'optic',
  order: 5,
  description: 'Lets only colours near its own through.',
  defaults: () => ({ length: 110, wavelength: 532, width: 35 }),
  normalize: (p) => ({ ...p, length: clamp(p.length, 20, 600) }),
  params: [
    { kind: 'wavelength', key: 'wavelength', label: 'Pass colour' },
    { kind: 'number', key: 'width', label: 'Band width', min: 5, max: 150, step: 1 },
    { kind: 'number', key: 'length', label: 'Length', min: 20, max: 600, step: 1 },
  ],

  boundsRadius: (p) => p.length / 2 + 2,
  hitTest: (p, l) => Math.abs(l.x) <= T / 2 + 4 && Math.abs(l.y) <= p.length / 2 + 2,
  handles: (p) => [{ id: 'end', position: { x: 0, y: p.length / 2 }, drag: (_p, l) => ({ length: Math.abs(l.y) * 2 }) }],
  surfaces: (p) => [
    { kind: 'segment', a: { x: 0, y: -p.length / 2 }, b: { x: 0, y: p.length / 2 }, material: bandpass(p.wavelength, p.width) },
  ],

  createView: () =>
    graphicsView<FilterProps>((g, p) => {
      const L = p.length;
      const c = beamColor(p.wavelength);
      g.roundRect(-T / 2 + 3, -L / 2 + 5, T, L, 2).fill({ color: 0x000000, alpha: 0.3 });
      g.roundRect(-T / 2, -L / 2, T, L, 2).fill({ color: c, alpha: 0.45 }).stroke({ width: 1, color: c, alpha: 0.9 });
      g.moveTo(-1, -L / 2 + 4).lineTo(-1, L / 2 - 4).stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
      g.roundRect(-T / 2 - 1.5, -L / 2 - 2, T + 3, 5, 2).fill(0x2a2f39);
      g.roundRect(-T / 2 - 1.5, L / 2 - 3, T + 3, 5, 2).fill(0x2a2f39);
    }),
};

export default filter;
