import { Clock } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { deviceBox, lead, led, SIGNAL_ON } from '../kit/device';
import { graphicsView } from '../render/viewkit';

interface ClockProps {
  /** Seconds per cycle. */
  period: number;
  /** Fraction of the cycle spent ON. */
  duty: number;
}

const W = 48;
const H = 32;

/** Square-wave oscillator. */
const clock: ElementDef<ClockProps> = {
  type: 'clock',
  label: 'Clock',
  icon: Clock,
  category: 'io',
  order: 3,
  description: 'Square-wave generator: drives counters, blinkers and flip-flops.',
  defaults: () => ({ period: 1, duty: 0.5 }),
  normalize: (p) => ({ period: clamp(p.period, 0.05, 30), duty: clamp(p.duty, 0.05, 0.95) }),
  params: [
    { kind: 'number', key: 'period', label: 'Period (s)', min: 0.05, max: 10, step: 0.05 },
    { kind: 'number', key: 'duty', label: 'Duty cycle', min: 0.05, max: 0.95, step: 0.05 },
  ],

  boundsRadius: () => Math.hypot(W, H) / 2,
  hitTest: (_p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= H / 2 + 2,
  ports: () => [{ id: 'out', dir: 'out', position: { x: W / 2 + 10, y: 0 }, normal: { x: 1, y: 0 }, label: 'clock signal' }],
  logic: ({ props, time }) => ({ out: (time % props.period) / props.period < props.duty }),

  createView: () =>
    graphicsView<ClockProps>((g, p, state) => {
      const on = !!state.signals.outputs.out;
      deviceBox(g, W, H, 6);
      // Square-wave glyph.
      const x0 = -W / 2 + 8;
      const hi = -5;
      const lo = 6;
      const d = 30 * p.duty;
      g.moveTo(x0, lo).lineTo(x0, hi).lineTo(x0 + d / 2, hi).lineTo(x0 + d / 2, lo).lineTo(x0 + 15, lo).lineTo(x0 + 15, hi).lineTo(x0 + 15 + d / 2, hi).lineTo(x0 + 15 + d / 2, lo).lineTo(x0 + 30, lo);
      g.stroke({ width: 1.6, color: on ? SIGNAL_ON : 0x8a95aa, join: 'miter' });
      led(g, W / 2 - 6, -H / 2 + 6, on);
      lead(g, W / 2, 0, W / 2 + 10, 0, on);
    }),
};

export default clock;
