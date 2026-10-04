import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Stoichiometric hydrogen + oxygen, stable until a spark starts the radical chain. */
const preset: Preset = {
  id: 'chamber-ignition',
  name: 'Hydrogen–Oxygen Ignition',
  group: 'Matter & particles',
  order: 48,
  build: () => {
    const button = el('button', 150, 640);
    const chamber = el('chamber', 860, 600, 0, {
      width: 1100,
      height: 600,
      walls: 'glass',
      thermal: 0.2,
      plugX: 0.14,
      plugY: 0.5,
      tLimit: 1500,
      fill: [
        { species: 'h2', count: 380, T: 293 },
        { species: 'o2', count: 190, T: 293 },
      ],
    });
    const hot = el('lamp', 1520, 600, 0, { color: 0xff8a3c });
    return scene(
      [
        button,
        chamber,
        hot,
        el('label', 150, 560, 0, { text: 'SPARK', size: 15, color: 0xf2f5fb }),
        el('label', 1600, 640, 0, { text: '> 1500 K', size: 14 }),
        el('label', 860, 190, 0, {
          text: '2 H₂ + O₂ sits quietly at room temperature — no collision is energetic enough to react. Press SPARK: the plasma splits molecules into H and O radicals, and the chain H + O₂ → OH + O, OH + H₂ → H₂O + H runs away. Watch the flame front glow across the chamber and fill it with water vapour (blue). Like real ignition it is probabilistic: if a spark fizzles, press again.',
          size: 17,
          width: 1200,
          color: 0xf2f5fb,
        }),
        el('label', 860, 960, 0, { text: 'Tip: use the ⚡ spark tool in the particle toolbar to ignite anywhere.', size: 15, width: 900 }),
      ],
      [wire(button, 'out', chamber, 'ignite'), wire(chamber, 'hot', hot, 'in')],
    );
  },
};

export default preset;
