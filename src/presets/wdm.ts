import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** Three colour channels share one beam (multiplex) and are separated again (demultiplex). */
const preset: Preset = {
  id: 'wdm',
  name: 'Wavelength Multiplexing (WDM)',
  group: 'Photonics',
  order: 12,
  build: () => {
    const y = 520;
    const sw = (sx: number, sy: number, on: boolean) => el('switch', sx, sy, 0, { on });
    const sR = sw(120, 640, true);
    const sG = sw(340, 960, true);
    const sB = sw(640, 960, false);
    const red = el('laser', 220, y, 0, { wavelength: 650 });
    const green = el('laser', 500, 820, -90, { wavelength: 532 });
    const blue = el('laser', 800, 820, -90, { wavelength: 450 });
    const muxG = el('dichroic', 500, y, 45, { wavelength: 532 });
    const muxB = el('dichroic', 800, y, 45, { wavelength: 450 });
    const demuxB = el('dichroic', 1150, y, 45, { wavelength: 450 });
    const demuxG = el('dichroic', 1350, y, 45, { wavelength: 532 });
    const dB = el('detector', 1150, 280, -90, { colorMatch: true, wavelength: 450, threshold: 0.4 });
    const dG = el('detector', 1350, 280, -90, { colorMatch: true, wavelength: 532, threshold: 0.4 });
    const dR = el('detector', 1640, y, 0, { colorMatch: true, wavelength: 650, threshold: 0.4 });
    const lB = el('lamp', 1150, 160, 0, { color: 0x4dc3ff });
    const lG = el('lamp', 1350, 160, 0, { color: 0x5cff8a });
    const lR = el('lamp', 1720, 380, 0, { color: 0xff4d4d });
    return scene(
      [
        sR,
        sG,
        sB,
        red,
        green,
        blue,
        muxG,
        muxB,
        demuxB,
        demuxG,
        dB,
        dG,
        dR,
        lB,
        lG,
        lR,
        el('label', 650, 330, 0, { text: 'MUX: dichroic mirrors merge three colours into one beam', size: 15, width: 360 }),
        el('label', 1400, 700, 0, { text: 'DEMUX: dichroics split them back out to colour detectors', size: 15, width: 360 }),
        el('label', 900, 90, 0, { text: 'Wavelength-division multiplexing: three independent signals travel on ONE beam. Flip the switches.', size: 17, width: 1000, color: 0xf2f5fb }),
      ],
      [
        wire(sR, 'out', red, 'en'),
        wire(sG, 'out', green, 'en'),
        wire(sB, 'out', blue, 'en'),
        wire(dB, 'out', lB, 'in'),
        wire(dG, 'out', lG, 'in'),
        wire(dR, 'out', lR, 'in'),
      ],
    );
  },
};

export default preset;
