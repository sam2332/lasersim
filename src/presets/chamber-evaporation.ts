import type { Preset } from './index';
import { el, scene } from './helpers';

/** Liquid water exposed to vacuum: it boils off until the vapour pressure is reached, cooling itself. */
const preset: Preset = {
  id: 'chamber-evaporation',
  name: 'Evaporation into Vacuum',
  group: 'Matter & particles',
  order: 41,
  build: () =>
    scene([
      el('chamber', 520, 600, 0, {
        width: 700,
        height: 640,
        wallTemp: 300,
        thermal: 0,
        gravity: 0.02,
        colorMode: 'speed',
        fill: [{ species: 'h2o', count: 700, T: 300, region: [0, 0.78, 1, 1] }],
      }),
      el('chamber', 1320, 600, 0, {
        width: 700,
        height: 640,
        wallTemp: 300,
        thermal: 1,
        gravity: 0.02,
        colorMode: 'speed',
        fill: [{ species: 'h2o', count: 700, T: 300, region: [0, 0.78, 1, 1] }],
      }),
      el('label', 520, 240, 0, { text: 'Insulated walls: the fastest molecules escape the liquid, so it cools down (evaporative cooling).', size: 16, width: 620, color: 0xf2f5fb }),
      el('label', 1320, 240, 0, { text: 'Warm walls at 300 K keep feeding heat in, so evaporation continues until the vapour pressure is reached.', size: 16, width: 620, color: 0xf2f5fb }),
      el('label', 920, 110, 0, { text: 'Colour = molecular speed (blue slow → red fast). Watch the vapour above the water.', size: 17, width: 1100 }),
    ]),
};

export default preset;
