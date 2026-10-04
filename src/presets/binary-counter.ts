import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Clock → ripple counter of T flip-flops → hex display and four lasers showing the bits. */
const preset: Preset = {
  id: 'binary-counter',
  name: '4-bit Counter → Lasers',
  group: 'Logic & signals',
  order: 25,
  build: () => {
    const clock = el('clock', 140, 380, 0, { period: 0.6 });
    const ffs = [0, 1, 2, 3].map((i) => el('flip-flop', 380 + i * 230, 380, 0, { mode: 'T' }));
    const hex = el('hex-display', 1420, 380, 0, { color: 0x3ee8ff });
    const colors = [650, 590, 532, 450];
    const lasers = colors.map((wavelength, i) => el('laser', 360, 640 + i * 110, 0, { wavelength }));
    const orbs = lasers.map((_l, i) => el('target', 1600, 640 + i * 110));
    const wires = [
      wire(clock, 'out', ffs[0], 'clk'),
      ...ffs.slice(1).map((ff, i) => wire(ffs[i], 'nq', ff, 'clk')),
      ...ffs.map((ff, i) => wire(ff, 'q', hex, `b${i}`)),
      ...ffs.map((ff, i) => wire(ff, 'q', lasers[i], 'en')),
    ];
    return scene(
      [
        clock,
        ...ffs,
        hex,
        ...lasers,
        ...orbs,
        ...['1', '2', '4', '8'].map((t, i) => el('label', 230, 640 + i * 110, 0, { text: `bit ${t}`, size: 15, color: 0xf2f5fb })),
        el('label', 800, 150, 0, {
          text: 'A clock ticks a ripple counter: a chain of T flip-flops, each toggling when the previous one falls. The bits count 0→F on the display and switch four lasers. Watch for the brief glitches as each carry ripples down the chain — real ripple counters do that too.',
          size: 17,
          width: 1000,
        }),
      ],
      wires,
    );
  },
};

export default preset;
