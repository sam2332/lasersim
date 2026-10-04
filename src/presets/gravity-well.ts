import type { Preset } from './index';
import { el, scene } from './helpers';

const preset: Preset = {
  id: 'gravity-well',
  name: 'Gravity Well',
  group: 'Optics',
  order: 3,
  build: () =>
    scene([
      ...Array.from({ length: 9 }, (_, i) => el('laser', 140, 230 + i * 80, 0, { wavelength: 680 - i * 32, power: 0.9 })),
      el('black-hole', 760, 420, 0, { horizon: 34, mass: 1.6 }),
      el('black-hole', 1180, 700, 0, { horizon: 22, mass: 0.9 }),
      el('splitter', 1500, 300, 45, { length: 120 }),
      el('target', 1650, 860),
    ]),
};

export default preset;
