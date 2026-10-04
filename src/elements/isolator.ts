import { ArrowRightToLine } from 'lucide';
import { plate, type PlateProps } from '../kit/plate';
import { oneWay } from '../optics/materials';

/** Optical diode: light passes along the arrow only (protects lasers from reflections). */
export default plate<PlateProps>({
  type: 'isolator',
  label: 'Optical isolator',
  icon: ArrowRightToLine,
  category: 'photonics',
  order: 7,
  description: 'Optical diode: passes light travelling along the arrow, blocks light coming back.',
  defaults: () => ({ length: 50 }),
  params: [],
  directional: true,
  material: () => oneWay,
  look: { color: 0x1b2028, alpha: 0.9, thickness: 26, edge: 0x5a6476 },
  decorate: (g, p) => {
    const L = p.length;
    g.rect(-13, -L / 2 + 6, 26, 4).fill(0x8a4b2a);
    g.rect(-13, L / 2 - 10, 26, 4).fill(0x8a4b2a);
    g.poly([-7, -6, 3, -6, 3, -10, 10, 0, 3, 10, 3, 6, -7, 6]).fill({ color: 0x8fb4ff, alpha: 0.9 });
  },
});
