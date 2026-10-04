import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Insulated cylinder + piston: squeezing the gas heats it, letting it expand cools it. */
const preset: Preset = {
  id: 'chamber-piston',
  name: 'Adiabatic Compression (Piston)',
  group: 'Matter & particles',
  order: 45,
  build: () => {
    const sw = el('switch', 180, 560);
    const cyl = el('chamber', 860, 560, 0, {
      width: 1000,
      height: 420,
      thermal: 0,
      piston: true,
      pistonPos: 0.35,
      colorMode: 'speed',
      tLimit: 500,
      fill: [{ species: 'he', count: 160, T: 293 }],
    });
    const hot = el('lamp', 1500, 600, 0, { color: 0xffb347 });
    return scene(
      [
        sw,
        cyl,
        hot,
        el('label', 180, 500, 0, { text: 'COMPRESS', size: 15, color: 0xf2f5fb }),
        el('label', 1580, 640, 0, { text: '> 500 K', size: 14 }),
        el('label', 860, 220, 0, {
          text: 'The walls are insulated, so no heat can leave. Push the piston in and every molecule that bounces off it comes back faster: the gas heats up (in 2D, T·V stays constant, so ⅓ the volume ≈ 3× the temperature). Release it and the gas cools as it expands — the principle behind diesel engines and fridges.',
          size: 17,
          width: 1300,
          color: 0xf2f5fb,
        }),
      ],
      [wire(sw, 'out', cyl, 'piston'), wire(cyl, 'hot', hot, 'in')],
    );
  },
};

export default preset;
