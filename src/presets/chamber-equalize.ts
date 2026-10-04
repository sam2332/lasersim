import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** A full tank and an evacuated tank joined by a valve: open it and watch pressure equalise. */
const preset: Preset = {
  id: 'chamber-equalize',
  name: 'Pressure Equalisation + Effusion',
  group: 'Matter & particles',
  order: 46,
  build: () => {
    const left = el('chamber', 460, 600, 0, {
      width: 600,
      height: 520,
      thermal: 0.6,
      fill: [
        { species: 'he', count: 220, T: 293 },
        { species: 'xe', count: 220, T: 293 },
      ],
    });
    const right = el('chamber', 1340, 600, 0, { width: 600, height: 520, thermal: 0.6 });
    // Pipe from the right wall of the left tank to the left wall of the right tank.
    const pipe = el('pipe', 760, 600, 0, { dx: 280, dy: 0, bore: 70, open: true });
    const sw = el('switch', 900, 820);
    return scene(
      [
        left,
        right,
        pipe,
        sw,
        el('label', 900, 900, 0, { text: 'VALVE', size: 15, color: 0xf2f5fb }),
        el('label', 900, 220, 0, {
          text: 'Left: helium + xenon at high pressure. Right: vacuum. Open the valve — gas rushes through until both sides read the same pressure. Light helium escapes ~5.7× faster than xenon at first, so the right tank starts out helium-rich (Graham\'s law of effusion).',
          size: 17,
          width: 1300,
          color: 0xf2f5fb,
        }),
      ],
      [wire(sw, 'out', pipe, 'ctrl')],
    );
  },
};

export default preset;
