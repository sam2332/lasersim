import type { Preset } from './index';
import { el, scene } from './helpers';

const preset: Preset = {
  id: 'lens-bench',
  name: 'Lens Bench',
  order: 2,
  build: () =>
    scene([
      el('laser', 180, 300, 0, { wavelength: 650 }),
      el('laser', 180, 360, 0, { wavelength: 532 }),
      el('laser', 180, 420, 0, { wavelength: 450 }),
      el('lens', 620, 360, 0, { height: 220, left: 30, right: 30, thickness: 8 }),
      el('target', 980, 360),
      el('rainbow', 180, 780, 0, { beams: 9, spacing: 9 }),
      el('lens', 620, 780, 0, { height: 200, left: -24, right: -24, thickness: 50 }),
      el('lens', 1000, 780, 0, { height: 300, left: 40, right: 0, thickness: 10 }),
      el('curved-mirror', 1600, 560, 180, { height: 360, depth: 50 }),
      el('target', 1380, 560),
    ]),
};

export default preset;
