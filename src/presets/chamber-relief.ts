import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Heater raises pressure; the chamber's over-pressure output opens its own vent — an automatic relief valve. */
const preset: Preset = {
  id: 'chamber-relief',
  name: 'Pressure Relief Valve',
  group: 'Matter & particles',
  order: 43,
  build: () => {
    const heat = el('switch', 220, 520);
    const chamber = el('chamber', 820, 560, 0, {
      width: 760,
      height: 520,
      wallTemp: 293,
      heaterTemp: 900,
      thermal: 0.8,
      pLimit: 150,
      tLimit: 500,
      colorMode: 'speed',
      fill: [{ species: 'n2', count: 360, T: 293 }],
    });
    const pressureLamp = el('lamp', 1400, 500, 0, { color: 0xff4d4d });
    const hotLamp = el('lamp', 1400, 620, 0, { color: 0xffb347 });
    return scene(
      [
        heat,
        chamber,
        pressureLamp,
        hotLamp,
        el('label', 220, 460, 0, { text: 'HEATER', size: 15, color: 0xf2f5fb }),
        el('label', 1520, 500, 0, { text: 'over pressure', size: 14 }),
        el('label', 1520, 620, 0, { text: 'over temperature', size: 14 }),
        el('label', 820, 180, 0, {
          text: 'Turn the heater on: hotter molecules hit the walls harder, so pressure rises (P = nkT/V). When it passes 150 atm the over-pressure output opens the vent on top and gas escapes until it is safe again. Use the spawn tool to top it back up.',
          size: 17,
          width: 1150,
          color: 0xf2f5fb,
        }),
      ],
      [
        wire(heat, 'out', chamber, 'heat'),
        wire(chamber, 'overP', chamber, 'vent'),
        wire(chamber, 'overP', pressureLamp, 'in'),
        wire(chamber, 'hot', hotLamp, 'in'),
      ],
    );
  },
};

export default preset;
