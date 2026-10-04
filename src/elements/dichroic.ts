import { Blend } from 'lucide';
import { plate, type PlateProps } from '../kit/plate';
import { dichroic as dichroicMaterial } from '../optics/materials';
import { beamColor } from '../optics/spectrum';

interface DichroicProps extends PlateProps {
  wavelength: number;
  width: number;
}

/** Reflects one colour band, passes the rest — the building block of wavelength multiplexing. */
export default plate<DichroicProps>({
  type: 'dichroic',
  label: 'Dichroic mirror',
  icon: Blend,
  category: 'photonics',
  order: 3,
  description: 'Reflects colours near its own and transmits everything else. Combines or separates colour channels (WDM).',
  defaults: () => ({ wavelength: 532, width: 35, length: 110 }),
  params: [
    { kind: 'wavelength', key: 'wavelength', label: 'Reflected colour' },
    { kind: 'number', key: 'width', label: 'Band width', min: 5, max: 150, step: 1 },
  ],
  material: (p) => dichroicMaterial(p.wavelength, p.width),
  look: { color: 0x9fb6d0, alpha: 0.25, thickness: 5 },
  decorate: (g, p) => {
    g.moveTo(0.5, -p.length / 2 + 3).lineTo(0.5, p.length / 2 - 3).stroke({ width: 2.2, color: beamColor(p.wavelength), alpha: 0.85 });
  },
});
