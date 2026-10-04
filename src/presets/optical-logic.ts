import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Logic done with light itself: detector thresholds for AND/OR, a shutter for NOT. */
const preset: Preset = {
  id: 'optical-logic',
  name: 'Optical Logic: AND · OR · NOT',
  group: 'Logic & signals',
  order: 21,
  build: () => {
    const row = (y: number, threshold: number) => {
      const sa = el('switch', 120, y - 70, 0, { on: true });
      const sb = el('switch', 120, y + 70, 0, { on: false });
      const la = el('laser', 380, y - 10, 0, { wavelength: 650 });
      const lb = el('laser', 600, y + 12, 0, { wavelength: 650 });
      const det = el('detector', 1040, y, 0, { threshold });
      const lamp = el('lamp', 1200, y, 0, { color: 0x5cff8a });
      return { els: [sa, sb, la, lb, det, lamp], wires: [wire(sa, 'out', la, 'en'), wire(sb, 'out', lb, 'en'), wire(det, 'out', lamp, 'in')] };
    };
    const and = row(200, 1.5);
    const or = row(540, 0.5);

    // NOT: an always-on beam through a shutter that closes when the input is ON.
    const sn = el('switch', 120, 880, 0, { on: false });
    const ln = el('laser', 380, 880, 0, { wavelength: 532 });
    const shutter = el('shutter', 720, 880, 0, { invert: true, length: 70 });
    const dn = el('detector', 1040, 880, 0, { threshold: 0.5 });
    const lampN = el('lamp', 1200, 880, 0, { color: 0x5cff8a });

    return scene(
      [
        ...and.els,
        ...or.els,
        sn,
        ln,
        shutter,
        dn,
        lampN,
        el('label', 1500, 200, 0, { text: 'AND — the detector needs 1.5 units of light, so BOTH beams must be on.', size: 16, width: 420 }),
        el('label', 1500, 540, 0, { text: 'OR — threshold 0.5: either beam alone is enough.', size: 16, width: 420 }),
        el('label', 1500, 880, 0, { text: 'NOT — an electro-optic shutter blocks the beam while the input is ON.', size: 16, width: 420 }),
        el('label', 700, 60, 0, { text: 'Logic with light: the beams ARE the signals', size: 24, width: 900, color: 0xf2f5fb }),
      ],
      [...and.wires, ...or.wires, wire(sn, 'out', shutter, 'ctrl'), wire(dn, 'out', lampN, 'in')],
    );
  },
};

export default preset;
