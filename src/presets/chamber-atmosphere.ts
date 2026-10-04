import type { Preset } from './index';
import { el, scene } from './helpers';

/** Gravity + temperature gives a barometric density profile; light gases spread higher. */
const preset: Preset = {
  id: 'chamber-atmosphere',
  name: 'Barometric Atmosphere',
  group: 'Matter & particles',
  order: 44,
  build: () =>
    scene([
      el('chamber', 900, 600, 0, {
        width: 900,
        height: 820,
        wallTemp: 293,
        thermal: 1,
        gravity: 0.03,
        fill: [
          { species: 'n2', count: 350, T: 293 },
          { species: 'he', count: 120, T: 293 },
          { species: 'co2', count: 120, T: 293 },
        ],
      }),
      el('label', 900, 130, 0, {
        text: 'With (exaggerated) gravity, density falls off exponentially with height: n(h) ∝ e^(−mgh/kT). Heavy CO₂ (grey) hugs the floor, nitrogen thins out with height, light helium (pink) spreads almost evenly.',
        size: 17,
        width: 1200,
        color: 0xf2f5fb,
      }),
    ]),
};

export default preset;
