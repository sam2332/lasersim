import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Natural gas in air: harder to light than hydrogen; burns to CO₂ and water via CH₃, CH₂O, HCO and CO. */
const preset: Preset = {
  id: 'chamber-methane',
  name: 'Methane in Air',
  group: 'Matter & particles',
  order: 49,
  build: () => {
    const button = el('button', 150, 640);
    const chamber = el('chamber', 860, 600, 0, {
      width: 1100,
      height: 600,
      walls: 'glass',
      thermal: 0.1,
      plugX: 0.5,
      plugY: 0.5,
      fill: [
        { species: 'ch4', count: 110, T: 293 },
        { species: 'o2', count: 220, T: 293 },
        { species: 'n2', count: 160, T: 293 },
      ],
    });
    return scene(
      [
        button,
        chamber,
        el('label', 150, 560, 0, { text: 'SPARK', size: 15, color: 0xf2f5fb }),
        el('label', 860, 190, 0, {
          text: 'Methane needs roughly ten times more spark energy than hydrogen, so a single spark may fizzle — press it a few times or hold the ⚡ spark tool. Once lit, CH₄ is stripped step by step: CH₃ → CH₂O → HCO → CO → CO₂, releasing water along the way.',
          size: 17,
          width: 1200,
          color: 0xf2f5fb,
        }),
      ],
      [wire(button, 'out', chamber, 'ignite')],
    );
  },
};

export default preset;
