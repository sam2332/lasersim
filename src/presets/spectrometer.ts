import type { Preset } from './index';
import { el, scene, wire } from './helpers';

/** White light → diffraction grating → colour detectors placed at each colour's angle. */
const preset: Preset = {
  id: 'spectrometer',
  name: 'Grating Spectrometer',
  group: 'Photonics',
  order: 13,
  build: () => {
    const gx = 600;
    const gy = 500;
    const lines = 1200;
    const r = 470;
    const channel = (nm: number, color: number) => {
      const theta = Math.asin((nm * lines) / 1e6);
      const x = gx + r * Math.cos(theta);
      const y = gy + r * Math.sin(theta);
      const deg = (theta * 180) / Math.PI;
      const d = el('detector', Math.round(x), Math.round(y), deg, { colorMatch: true, wavelength: nm, threshold: 0.12 });
      const lamp = el('lamp', Math.round(x + 200), Math.round(y + 20), 0, { color });
      return { d, lamp, w: wire(d, 'out', lamp, 'in') };
    };
    const chs = [channel(650, 0xff4d4d), channel(532, 0x5cff8a), channel(450, 0x4dc3ff)];
    return scene(
      [
        el('rainbow', 220, gy, 0, { beams: 12, spacing: 0 }),
        el('grating', gx, gy, 0, { lines, orders: 1, length: 140 }),
        ...chs.flatMap((c) => [c.d, c.lamp]),
        el('target', 1500, gy),
        el('label', 900, 110, 0, {
          text: 'A diffraction grating sends each colour off at its own angle (sin θ = λ/d). Detectors at the red, green and blue angles light their lamps. Try changing the grating lines/mm.',
          size: 17,
          width: 1000,
        }),
        el('label', 1500, 430, 0, { text: 'zeroth order (undiffracted)', size: 14 }),
      ],
      chs.map((c) => c.w),
    );
  },
};

export default preset;
