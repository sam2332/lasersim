import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** A laser that keeps itself on: its own light, seen by a detector, holds its enable line high. */
const preset: Preset = {
  id: 'optical-memory',
  name: 'Optical Memory Loop',
  group: 'Logic & signals',
  order: 23,
  build: () => {
    const laser = el('laser', 420, 450, 0, { wavelength: 650 });
    const shutter = el('shutter', 820, 450, 0, { invert: true, length: 70 });
    const det = el('detector', 1240, 450, 0, { threshold: 0.5 });
    const lamp = el('lamp', 1420, 450, 0, { color: 0xff4d4d });
    const or = el('gate', 620, 720, 0, { op: 'OR' });
    const set = el('button', 300, 760);
    const reset = el('button', 820, 760);
    return scene(
      [
        laser,
        shutter,
        det,
        lamp,
        or,
        set,
        reset,
        el('label', 300, 840, 0, { text: 'SET', size: 16, color: 0xf2f5fb }),
        el('label', 820, 840, 0, { text: 'RESET (closes the shutter)', size: 15, color: 0xf2f5fb, width: 220 }),
        el('label', 860, 170, 0, {
          text: 'Optical memory: press SET and the laser turns on. Its beam reaches the detector, which feeds back through the OR gate and keeps the laser on — the light remembers. RESET briefly blocks the beam and the loop collapses.',
          size: 17,
          width: 1000,
        }),
      ],
      [wire(set, 'out', or, 'a'), wire(det, 'out', or, 'b'), wire(or, 'out', laser, 'en'), wire(reset, 'out', shutter, 'ctrl'), wire(det, 'out', lamp, 'in')],
    );
  },
};

export default preset;
