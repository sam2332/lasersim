import { Flame } from 'lucide';
import { controlPort, plate, powered, type PlateProps } from '../kit/plate';
import { gain } from '../optics/materials';

interface AmplifierProps extends PlateProps {
  gain: number;
  /** Transmission when not pumped. */
  idle: number;
}

/**
 * Pumped gain medium. Unwired it is always pumped; wiring the control input
 * gates it — a signal switching light on and off is an optical transistor.
 */
export default plate<AmplifierProps>({
  type: 'amplifier',
  label: 'Optical amplifier',
  icon: Flame,
  category: 'photonics',
  order: 5,
  description: 'Pumped gain crystal: multiplies beam power. Wire the control input to pump it on/off (optical transistor).',
  defaults: () => ({ gain: 2, idle: 0, length: 60 }),
  params: [
    { kind: 'number', key: 'gain', label: 'Gain ×', min: 1, max: 6, step: 0.1 },
    { kind: 'number', key: 'idle', label: 'Unpumped pass', min: 0, max: 1, step: 0.05 },
  ],
  ports: (p) => [controlPort(p.length)],
  material: (p, sig) => gain(powered(sig) ? p.gain : p.idle),
  look: { color: 0xff4f86, alpha: 0.32, thickness: 22, edge: 0xffb3cb },
  decorate: (g, p, state) => {
    const on = powered(state.signals);
    const L = p.length;
    g.roundRect(-8, -L / 2 + 4, 16, L - 8, 6).fill({ color: on ? 0xff6b9b : 0x3a2030, alpha: on ? 0.55 : 0.4 });
    for (let y = -L / 2 + 8; y < L / 2 - 6; y += 9) g.moveTo(-11, y).lineTo(11, y + 4);
    g.stroke({ width: 1, color: on ? 0xffd0e0 : 0x6a4a58, alpha: 0.6 });
  },
});
