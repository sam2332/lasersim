import { SquareSplitHorizontal } from 'lucide';
import { controlPort, plate, powered, type PlateProps } from '../kit/plate';
import { mirror } from '../optics/materials';

interface SwitchMirrorProps extends PlateProps {
  invert: boolean;
}

/** Electrically switchable mirror (liquid-crystal / MEMS): reflects while active, clear otherwise. */
export default plate<SwitchMirrorProps>({
  type: 'switch-mirror',
  label: 'Switchable mirror',
  icon: SquareSplitHorizontal,
  category: 'photonics',
  order: 12,
  description: 'Mirror while its control input is high, transparent while low. Unwired = mirror. Routes beams with signals.',
  defaults: () => ({ invert: false, length: 90 }),
  params: [{ kind: 'boolean', key: 'invert', label: 'Invert (clear on high)' }],
  ports: (p) => [controlPort(p.length)],
  material: (p, sig) => (powered(sig, p.invert) ? mirror(0.96) : null),
  look: { color: 0xa8d8ff, alpha: 0.12, thickness: 7 },
  decorate: (g, p, state) => {
    const L = p.length;
    if (powered(state.signals, p.invert)) {
      g.roundRect(-3.5, -L / 2 + 2, 7, L - 4, 2).fill({ color: 0xdde6f5, alpha: 0.9 });
      g.moveTo(0, -L / 2 + 3).lineTo(0, L / 2 - 3).stroke({ width: 1.2, color: 0xffffff });
    }
  },
});
