import { ScanLine } from 'lucide';
import { rad } from '../core/math';
import { plate, type PlateProps } from '../kit/plate';
import { polarizer as polarizerMaterial } from '../optics/materials';

interface PolarizerProps extends PlateProps {
  /** Transmission axis, degrees. */
  axis: number;
}

/** Absorptive linear polarizer: passes cos²(θ) of polarized light, half of unpolarized. */
export default plate<PolarizerProps>({
  type: 'polarizer',
  label: 'Polarizer',
  icon: ScanLine,
  category: 'photonics',
  order: 0,
  description: 'Linear polarizer. Passes light polarized along its axis (Malus law), half of unpolarized light.',
  defaults: () => ({ axis: 0, length: 100 }),
  params: [{ kind: 'number', key: 'axis', label: 'Axis°', min: 0, max: 180, step: 1 }],
  material: (p) => polarizerMaterial(rad(p.axis)),
  look: { color: 0x2b3038, alpha: 0.8, edge: 0x9aa3b5 },
  badge: (p) => `${Math.round(p.axis)}°`,
  badgeAxis: (p) => rad(p.axis),
  decorate: (g, p) => {
    for (let y = -p.length / 2 + 6; y < p.length / 2 - 4; y += 5) g.moveTo(-2, y).lineTo(2, y);
    g.stroke({ width: 0.8, color: 0x8fb4ff, alpha: 0.35 });
  },
});
