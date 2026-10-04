import type { Preset } from './index';
import { el, scene } from './helpers';

/** Two gases released side by side diffuse into each other; light helium spreads much faster than heavy xenon. */
const preset: Preset = {
  id: 'chamber-mixing',
  name: 'Gas Diffusion (He + Xe)',
  group: 'Matter & particles',
  order: 42,
  build: () =>
    scene([
      el('chamber', 900, 580, 0, {
        width: 1400,
        height: 620,
        wallTemp: 293,
        thermal: 0.5,
        fill: [
          { species: 'he', count: 320, T: 293, region: [0, 0, 0.5, 1] },
          { species: 'xe', count: 320, T: 293, region: [0.5, 0, 1, 1] },
        ],
      }),
      el('label', 900, 180, 0, {
        text: 'Helium (pink, 4 u) on the left, xenon (blue, 131 u) on the right, same temperature. Both have the same average kinetic energy, so helium moves √(131/4) ≈ 5.7× faster and invades first (Graham\'s law).',
        size: 17,
        width: 1300,
        color: 0xf2f5fb,
      }),
    ]),
};

export default preset;
