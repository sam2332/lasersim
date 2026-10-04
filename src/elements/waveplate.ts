import { Activity } from 'lucide';
import { rad } from '../core/math';
import { plate, type PlateProps } from '../kit/plate';
import { waveplate as waveplateMaterial } from '../optics/materials';

interface WaveplateProps extends PlateProps {
  /** Fast axis, degrees. */
  axis: number;
  kind: 'half' | 'quarter';
}

/** Birefringent retarder. λ/2 rotates linear polarization; λ/4 turns linear into circular and back. */
export default plate<WaveplateProps>({
  type: 'waveplate',
  label: 'Wave plate',
  icon: Activity,
  category: 'photonics',
  order: 1,
  description: 'Retarder. λ/2 mirrors the polarization about its axis; λ/4 at 45° turns linear into circular, and two passes act like λ/2.',
  variants: [
    { label: 'Half-wave plate λ/2', props: { kind: 'half', axis: 22.5 } },
    { label: 'Quarter-wave plate λ/4', props: { kind: 'quarter', axis: 45 } },
  ],
  defaults: () => ({ axis: 22.5, kind: 'half', length: 100 }),
  params: [
    { kind: 'select', key: 'kind', label: 'Type', options: { 'Half-wave (λ/2)': 'half', 'Quarter-wave (λ/4)': 'quarter' } },
    { kind: 'number', key: 'axis', label: 'Fast axis°', min: 0, max: 180, step: 0.5 },
  ],
  material: (p) => waveplateMaterial(rad(p.axis), p.kind === 'half' ? Math.PI : Math.PI / 2),
  look: { color: 0x8fe0c8, alpha: 0.28, thickness: 5, edge: 0xc8fff0 },
  badge: (p) => (p.kind === 'half' ? 'λ/2' : 'λ/4'),
  badgeAxis: (p) => rad(p.axis),
});
