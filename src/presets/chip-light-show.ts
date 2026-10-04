import { getTemplate } from '../scripting/templates';
import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** A scripted chip sweeps four lasers; a second chip blinks Morse code. */
const preset: Preset = {
  id: 'chip-light-show',
  name: 'Programmable Chip: Light Show',
  group: 'Logic & signals',
  order: 30,
  build: () => {
    const scanner = getTemplate('scanner')!;
    const morse = getTemplate('morse')!;
    const fast = el('switch', 160, 530);
    const chip = el('mcu', 420, 530, 0, { name: 'SCANNER', inputs: scanner.inputs, outputs: scanner.outputs, code: scanner.code });
    const colors = [650, 590, 532, 450];
    const lasers = colors.map((wavelength, i) => el('laser', 760, 380 + i * 100, 0, { wavelength }));
    const orbs = lasers.map((_l, i) => el('target', 1560, 380 + i * 100));
    const beacon = el('mcu', 420, 900, 0, { name: 'MORSE', inputs: 0, outputs: 1, code: morse.code });
    const beaconLaser = el('laser', 760, 900, 0, { wavelength: 450 });
    const det = el('detector', 1300, 900, 0, { threshold: 0.5 });
    const lamp = el('lamp', 1460, 900, 0, { color: 0x4dc3ff });
    return scene(
      [
        fast,
        chip,
        ...lasers,
        ...orbs,
        beacon,
        beaconLaser,
        det,
        lamp,
        el('label', 160, 470, 0, { text: 'speed', size: 14 }),
        el('label', 900, 150, 0, {
          text: 'Microcontrollers run your own JavaScript every tick. Double-click a chip to open its code — try changing the pattern, then press Ctrl+S.',
          size: 17,
          width: 1000,
          color: 0xf2f5fb,
        }),
        el('label', 1050, 1000, 0, { text: 'This chip flashes "SOS LASER" in Morse code', size: 15, width: 500 }),
      ],
      [
        wire(fast, 'out', chip, 'in0'),
        ...lasers.map((l, i) => wire(chip, `out${i}`, l, 'en')),
        wire(beacon, 'out0', beaconLaser, 'en'),
        wire(det, 'out', lamp, 'in'),
      ],
    );
  },
};

export default preset;
