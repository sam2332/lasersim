import type { Preset } from './index';
import { el, scene } from './helpers';

/** The same argon at three wall temperatures: crystal, liquid + vapour, gas. */
const preset: Preset = {
  id: 'chamber-phases',
  name: 'States of Matter (Argon)',
  group: 'Matter & particles',
  order: 40,
  build: () => {
    const box = (x: number, T: number) =>
      el('chamber', x, 560, 0, { width: 520, height: 520, wallTemp: T, thermostat: true, thermal: 1, gravity: 0.01, fill: [{ species: 'ar', count: 420, T }] });
    return scene([
      box(320, 40),
      box(900, 115),
      box(1480, 300),
      el('label', 320, 260, 0, { text: '40 K — solid: molecules lock into a hexagonal crystal', size: 16, width: 460, color: 0xf2f5fb }),
      el('label', 900, 260, 0, { text: '115 K — liquid pools at the bottom, vapour above', size: 16, width: 460, color: 0xf2f5fb }),
      el('label', 1480, 260, 0, { text: '300 K — gas: molecules fly freely and fill the box', size: 16, width: 460, color: 0xf2f5fb }),
      el('label', 900, 110, 0, {
        text: 'Nothing here is scripted — the phases come from Lennard-Jones forces between molecules. Change a chamber\'s wall temperature in the inspector and watch it melt or freeze.',
        size: 17,
        width: 1200,
      }),
    ]);
  },
};

export default preset;
