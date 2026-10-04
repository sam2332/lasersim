import { CircleDot } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { deviceBox, lead, SIGNAL_ON } from '../kit/device';
import { graphicsView } from '../render/viewkit';

interface ButtonProps {
  /** How long a press keeps the output high, seconds. */
  hold: number;
}

const S = 34;

/** Momentary push button: a click sends a short pulse. */
const button: ElementDef<ButtonProps> = {
  type: 'button',
  label: 'Push button',
  icon: CircleDot,
  category: 'io',
  order: 2,
  description: 'Click to send a short ON pulse (set, reset, clock by hand…).',
  defaults: () => ({ hold: 0.3 }),
  normalize: (p) => ({ hold: clamp(p.hold, 0.05, 5) }),
  params: [{ kind: 'number', key: 'hold', label: 'Pulse length (s)', min: 0.05, max: 5, step: 0.05 }],
  trigger: true,
  clickActivate: true,

  boundsRadius: () => S / 2 + 3,
  hitTest: (_p, l) => Math.abs(l.x) <= S / 2 + 2 && Math.abs(l.y) <= S / 2 + 2,
  ports: () => [{ id: 'out', dir: 'out', position: { x: S / 2 + 10, y: 0 }, normal: { x: 1, y: 0 } }],
  logic: ({ props, state, time, triggered }) => {
    if (triggered) state.until = time + props.hold;
    return { out: time < (state.until ?? -1) };
  },

  createView: () =>
    graphicsView<ButtonProps>((g, _p, state) => {
      const on = !!state.signals.outputs.out;
      deviceBox(g, S, S, 7);
      g.circle(0, on ? 1 : 0, 11).fill(on ? 0x1d6e7c : 0x8a2a33).stroke({ width: 2, color: on ? SIGNAL_ON : 0xd04a55 });
      g.circle(-3, on ? -2 : -3, 4).fill({ color: 0xffffff, alpha: on ? 0.25 : 0.35 });
      lead(g, S / 2, 0, S / 2 + 10, 0, on);
    }),
};

export default button;
