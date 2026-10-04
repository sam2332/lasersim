import { SunDim } from 'lucide';
import { plate, type PlateProps } from '../kit/plate';
import { gain } from '../optics/materials';

interface NdProps extends PlateProps {
  transmission: number;
}

/** Neutral-density filter: dims every colour equally. */
export default plate<NdProps>({
  type: 'nd-filter',
  label: 'ND filter',
  icon: SunDim,
  category: 'photonics',
  order: 9,
  description: 'Neutral-density filter: passes a fixed fraction of light. Handy for tuning detector thresholds.',
  defaults: () => ({ transmission: 0.5, length: 90 }),
  params: [{ kind: 'number', key: 'transmission', label: 'Transmission', min: 0, max: 1, step: 0.05 }],
  info: (p) => ({ 'Optical density': p.transmission > 0 ? (-Math.log10(p.transmission)).toFixed(2) : '∞' }),
  material: (p) => gain(p.transmission),
  look: { color: 0x5a5f68, alpha: 0.6, thickness: 6 },
  decorate: (g, p) => {
    g.roundRect(-3, -p.length / 2, 6, p.length, 2).fill({ color: 0x000000, alpha: 0.6 * (1 - p.transmission) });
  },
});
