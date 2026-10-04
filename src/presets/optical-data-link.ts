import { getTemplate } from '../scripting/templates';
import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** One chip sends numbers as light pulses; another decodes them on the far side. */
const preset: Preset = {
  id: 'optical-data-link',
  name: 'Optical Data Link (2 chips)',
  group: 'Logic & signals',
  order: 31,
  build: () => {
    const txCode = getTemplate('tx')!;
    const rxCode = getTemplate('rx')!;
    const tx = el('mcu', 220, 560, 0, { name: 'TX', inputs: 0, outputs: 5, code: txCode.code });
    const sent = el('hex-display', 230, 840, 0, { color: 0xffb347 });
    const laser = el('laser', 470, 560, 0, { wavelength: 650 });
    const m1 = el('mirror', 1000, 560, 45, { length: 70 });
    const m2 = el('mirror', 1000, 300, 45, { length: 70 });
    const det = el('detector', 1300, 300, 0, { threshold: 0.5 });
    const rx = el('mcu', 1520, 420, 0, { name: 'RX', inputs: 1, outputs: 4, code: rxCode.code });
    const received = el('hex-display', 1520, 700, 0, { color: 0x5cff8a });
    return scene(
      [
        tx,
        sent,
        laser,
        m1,
        m2,
        det,
        rx,
        received,
        el('label', 230, 960, 0, { text: 'sent', size: 15, color: 0xf2f5fb }),
        el('label', 1520, 820, 0, { text: 'received', size: 15, color: 0xf2f5fb }),
        el('label', 900, 130, 0, {
          text: 'Serial data over light: the TX chip sends 0→F as frames (start bit + 4 data bits). The RX chip times the pulses from the detector and rebuilds each number. Open both chips to see the protocol.',
          size: 17,
          width: 1100,
          color: 0xf2f5fb,
        }),
      ],
      [
        wire(tx, 'out0', laser, 'en'),
        ...[0, 1, 2, 3].map((b) => wire(tx, `out${b + 1}`, sent, `b${b}`)),
        wire(det, 'out', rx, 'in0'),
        ...[0, 1, 2, 3].map((b) => wire(rx, `out${b}`, received, `b${b}`)),
      ],
    );
  },
};

export default preset;
