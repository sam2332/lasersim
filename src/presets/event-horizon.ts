import type { Preset } from './index';
import { el, scene } from './helpers';

const preset: Preset = {
  id: 'event-horizon',
  name: 'Event Horizon',
  order: 0,
  build: () =>
    scene([
      el('rainbow', 380, 900, -90),
      el('black-hole', 1060, 440, 0, { horizon: 30, mass: 1.2 }),
      el('mirror', 380, 200, 45, { length: 120 }),
      el('mirror', 1460, 640, 0, { length: 120 }),
      el('target', 1500, 820),
      el('target', 1500, 960),
    ]),
};

export default preset;
