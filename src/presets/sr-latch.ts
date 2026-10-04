import type { Preset } from './index';
import { el, scene, wire } from './helpers';

const preset: Preset = {
  id: 'sr-latch',
  name: 'SR Latch (cross-coupled NOR)',
  group: 'Logic & signals',
  order: 22,
  build: () => {
    const R = el('button', 200, 360);
    const S = el('button', 200, 760);
    const top = el('gate', 700, 400, 0, { op: 'NOR', init: false });
    const bottom = el('gate', 700, 720, 0, { op: 'NOR', init: true });
    const q = el('lamp', 1000, 400, 0, { color: 0x5cff8a });
    const nq = el('lamp', 1000, 720, 0, { color: 0xff4d4d });

    // Same buttons also drive a ready-made SR flip-flop for comparison.
    const ff = el('flip-flop', 1350, 560, 0, { mode: 'SR' });
    const q2 = el('lamp', 1560, 520, 0, { color: 0x5cff8a });
    const nq2 = el('lamp', 1560, 600, 0, { color: 0xff4d4d });

    // Q drives a laser that lights an orb.
    const laser = el('laser', 1120, 950, 0, { wavelength: 532 });
    const orb = el('target', 1620, 950);

    return scene(
      [
        el('label', 200, 290, 0, { text: 'RESET', size: 16, color: 0xf2f5fb }),
        el('label', 200, 690, 0, { text: 'SET', size: 16, color: 0xf2f5fb }),
        R,
        S,
        top,
        bottom,
        q,
        nq,
        el('label', 1000, 350, 0, { text: 'Q', size: 18, color: 0xf2f5fb }),
        el('label', 1000, 670, 0, { text: 'Q̄', size: 18, color: 0xf2f5fb }),
        ff,
        q2,
        nq2,
        laser,
        orb,
        el('label', 700, 120, 0, {
          text: 'Two NOR gates feeding each other remember one bit. Press SET, then RESET — the output stays put after you let go.',
          size: 17,
          width: 900,
        }),
        el('label', 1350, 440, 0, { text: 'Built-in SR latch', size: 14 }),
        el('label', 1380, 1030, 0, { text: 'Q also powers this laser', size: 14 }),
      ],
      [
        wire(R, 'out', top, 'a'),
        wire(bottom, 'out', top, 'b'),
        wire(top, 'out', bottom, 'a'),
        wire(S, 'out', bottom, 'b'),
        wire(top, 'out', q, 'in'),
        wire(bottom, 'out', nq, 'in'),
        wire(S, 'out', ff, 's'),
        wire(R, 'out', ff, 'r'),
        wire(ff, 'out' === 'out' ? 'q' : 'q', q2, 'in'),
        wire(ff, 'nq', nq2, 'in'),
        wire(top, 'out', laser, 'en'),
      ],
    );
  },
};

export default preset;
