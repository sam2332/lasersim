import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Feedback control: a gas inlet that turns itself off once the chamber reaches its pressure limit. */
const preset: Preset = {
  id: 'chamber-regulator',
  name: 'Pressure Regulator (feedback)',
  group: 'Matter & particles',
  order: 47,
  build: () => {
    const enable = el('switch', 160, 470, 0, { on: true });
    const not = el('gate', 360, 640, 0, { op: 'NOT' });
    const and = el('gate', 360, 470, 0, { op: 'AND' });
    const ch = el('chamber', 960, 560, 0, {
      width: 860,
      height: 560,
      thermal: 0.8,
      inletSpecies: 'n2',
      inletRate: 60,
      pLimit: 60,
      colorMode: 'species',
    });
    const leak = el('switch', 160, 800);
    const lamp = el('lamp', 1520, 520, 0, { color: 0xff4d4d });
    return scene(
      [
        enable,
        not,
        and,
        ch,
        leak,
        lamp,
        el('label', 160, 410, 0, { text: 'REGULATOR ON', size: 14, color: 0xf2f5fb }),
        el('label', 160, 740, 0, { text: 'LEAK (vent)', size: 14, color: 0xf2f5fb }),
        el('label', 1600, 520, 0, { text: 'at limit', size: 14 }),
        el('label', 900, 200, 0, {
          text: 'Inlet = ON AND NOT(pressure > 60 atm). Nitrogen streams in until the limit, then stops. Open the leak and the controller keeps topping it back up — a closed feedback loop running on real gas pressure.',
          size: 17,
          width: 1200,
          color: 0xf2f5fb,
        }),
      ],
      [
        wire(enable, 'out', and, 'a'),
        wire(ch, 'overP', not, 'a'),
        wire(not, 'out', and, 'b'),
        wire(and, 'out', ch, 'inlet'),
        wire(leak, 'out', ch, 'vent'),
        wire(ch, 'overP', lamp, 'in'),
      ],
    );
  },
};

export default preset;
