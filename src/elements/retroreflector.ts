import { Undo2 } from 'lucide';
import { plate, type PlateProps } from '../kit/plate';
import { retroreflector as retroMaterial } from '../optics/materials';

/** Corner-cube retroreflector: sends light straight back the way it came, at any angle. */
export default plate<PlateProps>({
  type: 'retroreflector',
  label: 'Retroreflector',
  icon: Undo2,
  category: 'photonics',
  order: 10,
  description: 'Corner cube: returns every beam exactly back along its path, whatever the angle.',
  defaults: () => ({ length: 80 }),
  params: [],
  material: () => retroMaterial,
  look: { color: 0xaab4c4, alpha: 0.5, thickness: 14 },
  decorate: (g, p) => {
    for (let y = -p.length / 2 + 2; y < p.length / 2 - 8; y += 12) g.poly([-7, y, 7, y + 6, -7, y + 12]).stroke({ width: 1, color: 0xffffff, alpha: 0.45 });
  },
});
