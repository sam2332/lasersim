import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Back-reflections are bad for lasers; isolators stop them. A beam splitter samples any returning light. */
const preset: Preset = {
  id: 'isolators',
  name: 'Optical Isolators',
  group: 'Photonics',
  order: 14,
  build: () => {
    const row = (y: number, middle: ReturnType<typeof el>[], text: string) => {
      const monitor = el('detector', 600, y + 170, 90, { threshold: 0.1 });
      const lamp = el('lamp', 600, y + 260, 0, { color: 0xff4d4d });
      return {
        els: [
          el('laser', 200, y, 0, { wavelength: 650, polarization: 0 }),
          el('splitter', 600, y, 45, { length: 80, ratio: 0.5 }),
          ...middle,
          el('mirror', 1300, y, 0, { length: 80 }),
          monitor,
          lamp,
          el('label', 1580, y, 0, { text, size: 15, width: 360 }),
        ],
        wires: [wire(monitor, 'out', lamp, 'in')],
      };
    };
    const r1 = row(130, [], 'No isolator: the mirror bounces light straight back. The red lamp (back-reflection monitor) lights.');
    const r2 = row(470, [el('isolator', 950, 470)], 'Optical diode: passes the outgoing beam, blocks the return. Monitor stays dark.');
    const r3 = row(800, [el('polarizer', 850, 800, 0, { axis: 0, length: 70 }), el('faraday', 950, 800, 0, { angle: 45 }), el('polarizer', 1050, 800, 0, { axis: 45, length: 70 })],
      'Real Faraday isolator: 0° polarizer → 45° Faraday rotation → 45° polarizer. On the way back the rotation ADDS to 90°, so the first polarizer blocks it.');
    return scene([...r1.els, ...r2.els, ...r3.els], [...r1.wires, ...r2.wires, ...r3.wires]);
  },
};

export default preset;
