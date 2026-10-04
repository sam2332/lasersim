import { WandSparkles } from 'lucide';
import { plate, type PlateProps } from '../kit/plate';
import { converter as converterMaterial } from '../optics/materials';
import { beamColor } from '../optics/spectrum';

interface ConverterProps extends PlateProps {
  wavelength: number;
  efficiency: number;
}

/** Nonlinear crystal / phosphor that re-emits light at its own colour. */
export default plate<ConverterProps>({
  type: 'converter',
  label: 'Wavelength converter',
  icon: WandSparkles,
  category: 'photonics',
  order: 6,
  description: 'Nonlinear crystal: shifts any light passing through to its output colour.',
  defaults: () => ({ wavelength: 450, efficiency: 0.7, length: 70 }),
  params: [
    { kind: 'wavelength', key: 'wavelength', label: 'Output colour' },
    { kind: 'number', key: 'efficiency', label: 'Efficiency', min: 0.05, max: 1, step: 0.05 },
  ],
  material: (p) => converterMaterial(p.wavelength, p.efficiency),
  look: { color: 0xdfe8ff, alpha: 0.18, thickness: 16 },
  decorate: (g, p) => {
    const c = beamColor(p.wavelength);
    g.poly([-6, -p.length / 2 + 6, 6, -p.length / 2 + 14, 6, p.length / 2 - 6, -6, p.length / 2 - 14])
      .fill({ color: c, alpha: 0.35 })
      .stroke({ width: 1, color: c, alpha: 0.9 });
  },
});
