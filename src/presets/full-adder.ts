import type { Preset } from './index';
import { el, scene, wire } from './helpers';

const preset: Preset = {
  id: 'full-adder',
  name: 'Full Adder',
  group: 'Logic & signals',
  order: 26,
  build: () => {
    const A = el('switch', 180, 330, 0, { on: true });
    const B = el('switch', 180, 520, 0, { on: true });
    const C = el('switch', 180, 820, 0, { on: false });
    const xor1 = el('gate', 520, 420, 0, { op: 'XOR' });
    const and1 = el('gate', 520, 640, 0, { op: 'AND' });
    const xor2 = el('gate', 860, 460, 0, { op: 'XOR' });
    const and2 = el('gate', 860, 760, 0, { op: 'AND' });
    const or = el('gate', 1160, 700, 0, { op: 'OR' });
    const sum = el('lamp', 1200, 460, 0, { color: 0x5cff8a });
    const carry = el('lamp', 1380, 700, 0, { color: 0xffb347 });
    const hex = el('hex-display', 1580, 560, 0, { color: 0x5cff8a });
    return scene(
      [
        ...[
          ['A', 330],
          ['B', 520],
          ['Carry in', 820],
        ].map(([t, y]) => el('label', 180, (y as number) - 50, 0, { text: t as string, size: 16, color: 0xf2f5fb })),
        A,
        B,
        C,
        xor1,
        and1,
        xor2,
        and2,
        or,
        sum,
        carry,
        hex,
        el('label', 1200, 410, 0, { text: 'Sum', size: 16, color: 0xf2f5fb }),
        el('label', 1380, 650, 0, { text: 'Carry out', size: 16, color: 0xf2f5fb }),
        el('label', 800, 150, 0, { text: 'Adds three bits: A + B + carry. Sum = A ⊕ B ⊕ Cin, Carry = AB + Cin(A ⊕ B). The display shows the 2-bit result.', size: 17, width: 1000 }),
      ],
      [
        wire(A, 'out', xor1, 'a'),
        wire(B, 'out', xor1, 'b'),
        wire(A, 'out', and1, 'a'),
        wire(B, 'out', and1, 'b'),
        wire(xor1, 'out', xor2, 'a'),
        wire(C, 'out', xor2, 'b'),
        wire(xor1, 'out', and2, 'a'),
        wire(C, 'out', and2, 'b'),
        wire(and1, 'out', or, 'a'),
        wire(and2, 'out', or, 'b'),
        wire(xor2, 'out', sum, 'in'),
        wire(or, 'out', carry, 'in'),
        wire(xor2, 'out', hex, 'b0'),
        wire(or, 'out', hex, 'b1'),
      ],
    );
  },
};

export default preset;
