import { Aperture } from 'lucide';
import { controlPort, plate, powered, type PlateProps } from '../kit/plate';
import { absorber } from '../optics/materials';

interface ShutterProps extends PlateProps {
  /** Closed when the control signal is high instead of open. */
  invert: boolean;
}

/** Electro-optic shutter (Pockels cell): a signal opens or closes it. */
export default plate<ShutterProps>({
  type: 'shutter',
  label: 'Electro-optic shutter',
  icon: Aperture,
  category: 'photonics',
  order: 11,
  description: 'Pockels-cell shutter: open while its control input is high (or low, when inverted). Unwired = open.',
  defaults: () => ({ invert: false, length: 70 }),
  params: [{ kind: 'boolean', key: 'invert', label: 'Invert (closed on high)' }],
  ports: (p) => [controlPort(p.length)],
  material: (p, sig) => (powered(sig, p.invert) ? null : absorber),
  look: { color: 0xa8d8ff, alpha: 0.15, thickness: 16 },
  decorate: (g, p, state) => {
    const open = powered(state.signals, p.invert);
    const L = p.length;
    if (!open) {
      g.roundRect(-8, -L / 2, 16, L, 2).fill({ color: 0x07080b, alpha: 0.92 });
      for (let y = -L / 2 + 5; y < L / 2 - 2; y += 7) g.moveTo(-7, y).lineTo(7, y + 5);
      g.stroke({ width: 1, color: 0x3a4252 });
    }
    g.circle(0, -L / 2 + 6, 2.2).fill(open ? 0x6dff9c : 0xff5a5a);
  },
});
