import type { Preset } from './index';
import { el, scene, wire } from './helpers';

const preset: Preset = {
  id: 'logic-gates',
  name: 'Logic Gate Gallery',
  group: 'Logic & signals',
  order: 20,
  build: () => {
    const A = el('switch', 260, 420);
    const B = el('switch', 260, 700, 0, { on: true });
    const ops = ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR'] as const;
    const gates = ops.map((op, i) => el('gate', 820, 150 + i * 135, 0, { op }));
    const not = el('gate', 820, 960, 0, { op: 'NOT' });
    const lamps = [...gates, not].map((_g, i) => el('lamp', 1060, 150 + i * 135, 0, { color: 0x5cff8a }));
    const wires = [
      ...gates.flatMap((g) => [wire(A, 'out', g, 'a'), wire(B, 'out', g, 'b')]),
      wire(A, 'out', not, 'a'),
      ...[...gates, not].map((g, i) => wire(g, 'out', lamps[i], 'in')),
    ];
    return scene(
      [
        el('label', 260, 330, 0, { text: 'A', size: 26, color: 0xf2f5fb }),
        el('label', 260, 610, 0, { text: 'B', size: 26, color: 0xf2f5fb }),
        el('label', 260, 860, 0, { text: 'Click the switches to change A and B', size: 15, width: 240 }),
        A,
        B,
        ...gates,
        not,
        ...lamps,
        el('label', 1440, 420, 0, {
          text: 'A B │ AND OR NAND NOR XOR XNOR\n0 0 │  0   0   1    1   0    1\n0 1 │  0   1   1    0   1    0\n1 0 │  0   1   1    0   1    0\n1 1 │  1   1   0    0   0    1',
          size: 15,
          width: 520,
          color: 0xaab6cc,
        }),
        el('label', 1440, 620, 0, { text: 'Every gate gets the same two inputs. Lamps show each output. The NOT gate inverts A.', size: 15, width: 420 }),
      ],
      wires,
    );
  },
};

export default preset;
