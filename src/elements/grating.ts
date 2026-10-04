import { Barcode } from 'lucide';
import { plate, type PlateProps } from '../kit/plate';
import { grating as gratingMaterial } from '../optics/materials';
import { beamColor } from '../optics/spectrum';

interface GratingProps extends PlateProps {
  lines: number;
  orders: number;
}

/** Transmission diffraction grating: splits light into orders, each colour at its own angle. */
export default plate<GratingProps>({
  type: 'grating',
  label: 'Diffraction grating',
  icon: Barcode,
  category: 'photonics',
  order: 4,
  description: 'Splits each beam into diffraction orders (sin θ = sin θi + mλ/d). Longer wavelengths bend more.',
  defaults: () => ({ lines: 600, orders: 1, length: 120 }),
  normalize: (p) => ({ ...p, orders: Math.round(Math.min(3, Math.max(1, p.orders))) }),
  params: [
    { kind: 'number', key: 'lines', label: 'Lines / mm', min: 100, max: 1500, step: 10 },
    { kind: 'number', key: 'orders', label: 'Max order', min: 1, max: 3, step: 1 },
  ],
  info: (p) => ({ Spacing: `${Math.round(1e6 / p.lines)} nm` }),
  material: (p) => gratingMaterial(p.lines, p.orders),
  look: { color: 0x2a3140, alpha: 0.7, thickness: 7 },
  decorate: (g, p) => {
    const L = p.length;
    for (let y = -L / 2 + 4, i = 0; y < L / 2 - 4; y += 3, i++) {
      g.moveTo(-2.5, y).lineTo(2.5, y).stroke({ width: 0.8, color: beamColor(420 + ((i * 23) % 260)), alpha: 0.55 });
    }
  },
});
