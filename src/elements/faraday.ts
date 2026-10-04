import { Magnet } from 'lucide';
import { rad } from '../core/math';
import { plate, type PlateProps } from '../kit/plate';
import { faraday as faradayMaterial } from '../optics/materials';

interface FaradayProps extends PlateProps {
  angle: number;
}

/** Faraday rotator: rotates polarization the same way in both directions (non-reciprocal). */
export default plate<FaradayProps>({
  type: 'faraday',
  label: 'Faraday rotator',
  icon: Magnet,
  category: 'photonics',
  order: 8,
  description: 'Magneto-optic rotator. Unlike a wave plate, a round trip doubles the rotation — the heart of real optical isolators.',
  defaults: () => ({ angle: 45, length: 60 }),
  params: [{ kind: 'number', key: 'angle', label: 'Rotation°', min: -90, max: 90, step: 1 }],
  material: (p) => faradayMaterial(rad(p.angle)),
  look: { color: 0x7a5cff, alpha: 0.25, thickness: 18, edge: 0xc8b8ff },
  badge: (p) => `↻${Math.round(p.angle)}°`,
  decorate: (g, p) => {
    for (let y = -p.length / 2 + 6; y < p.length / 2 - 4; y += 6) g.rect(-9, y, 18, 2.5).fill({ color: 0xb87333, alpha: 0.75 });
  },
});
