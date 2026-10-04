import { Layers } from 'lucide';
import { rad } from '../core/math';
import { plate, type PlateProps } from '../kit/plate';
import { polarizingSplitter } from '../optics/materials';

interface ReflectivePolarizerProps extends PlateProps {
  axis: number;
}

/** Wire-grid / film reflective polarizer: transmits one polarization, reflects the other. */
export default plate<ReflectivePolarizerProps>({
  type: 'reflective-polarizer',
  label: 'Reflective polarizer',
  icon: Layers,
  category: 'photonics',
  order: 2,
  description: 'Transmits light polarized along its axis and mirrors the orthogonal polarization (used in pancake lenses).',
  defaults: () => ({ axis: 45, length: 200 }),
  params: [{ kind: 'number', key: 'axis', label: 'Pass axis°', min: 0, max: 180, step: 1 }],
  material: (p) => polarizingSplitter(rad(p.axis)),
  look: { color: 0xb8c4d8, alpha: 0.4, thickness: 5, edge: 0xe8eef8 },
  badge: (p) => `${Math.round(p.axis)}°`,
  badgeAxis: (p) => rad(p.axis),
});
