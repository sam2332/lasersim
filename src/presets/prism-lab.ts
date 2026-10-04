import type { Preset } from './index';
import { el, scene } from './helpers';

const preset: Preset = {
  id: 'prism-lab',
  name: 'Prism Lab',
  group: 'Optics',
  order: 1,
  build: () =>
    scene([
      el('rainbow', 260, 600, -12, { beams: 14, spacing: 0 }),
      el('prism', 760, 480, 0, { size: 200, dispersion: 2.5 }),
      el('lens', 1180, 560, 0, { height: 260, left: 30, right: 30 }),
      el('filter', 1450, 300, 0, { wavelength: 470 }),
      el('target', 1640, 560),
      el('target', 1640, 300),
    ]),
};

export default preset;
