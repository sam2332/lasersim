import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Light that switches itself off: an inverting optical feedback loop oscillates on its own. */
const preset: Preset = {
  id: 'ring-oscillator',
  name: 'Optical Ring Oscillator',
  group: 'Logic & signals',
  order: 24,
  build: () => {
    const laser = el('laser', 360, 380, 0, { wavelength: 532 });
    const det = el('detector', 1000, 380, 0, { threshold: 0.5 });
    const not = el('gate', 680, 620, 0, { op: 'NOT', delay: 5 });
    const lamp = el('lamp', 1180, 380, 0, { color: 0x5cff8a });

    // Frequency divider: two T flip-flops halve the blink rate twice.
    const ff1 = el('flip-flop', 1000, 760, 0, { mode: 'T' });
    const ff2 = el('flip-flop', 1250, 760, 0, { mode: 'T' });
    const l1 = el('lamp', 1180, 900, 0, { color: 0xffb347 });
    const l2 = el('lamp', 1420, 900, 0, { color: 0xff4d4d });

    return scene(
      [
        laser,
        det,
        not,
        lamp,
        ff1,
        ff2,
        l1,
        l2,
        el('label', 760, 150, 0, {
          text: 'Laser → detector → NOT → laser. When the light arrives it switches the laser off, which switches it back on… The loop oscillates by itself. Raise the NOT gate delay to slow it down.',
          size: 17,
          width: 1000,
        }),
        el('label', 1120, 1000, 0, { text: '÷2 and ÷4 frequency divider', size: 15 }),
      ],
      [
        wire(det, 'out', not, 'a'),
        wire(not, 'out', laser, 'en'),
        wire(det, 'out', lamp, 'in'),
        wire(det, 'out', ff1, 'clk'),
        wire(ff1, 'nq', ff2, 'clk'),
        wire(ff1, 'q', l1, 'in'),
        wire(ff2, 'q', l2, 'in'),
      ],
    );
  },
};

export default preset;
