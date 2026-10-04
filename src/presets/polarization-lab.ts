import type { Preset } from './index';
import { el, scene, wire } from './helpers';

const preset: Preset = {
  id: 'polarization-lab',
  name: 'Polarization Lab',
  group: 'Photonics',
  order: 10,
  build: () => {
    const meter = (x: number, y: number, rot = 0, threshold = 0.08) => {
      const d = el('detector', x, y, rot, { threshold });
      const lamp = el('lamp', x + (rot === 0 ? 150 : 80), y, 0, { color: 0x5cff8a });
      return { d, lamp, w: wire(d, 'out', lamp, 'in') };
    };

    // Row 1: crossed polarizers block everything.
    const m1 = meter(1150, 170);
    // Row 2: a 45° polarizer between them lets light through again.
    const m2 = meter(1150, 410);
    // Row 3: λ/2 plate sets 45°, PBS splits it 50/50.
    const m3a = meter(1150, 680);
    const m3b = meter(820, 540, -90);
    // Row 4: λ/4 at 45° makes circular light; any polarizer passes half.
    const m4 = meter(1150, 950);

    return scene(
      [
        el('laser', 160, 170, 0, { wavelength: 600, polarization: -1 }),
        el('polarizer', 450, 170, 0, { axis: 0 }),
        el('polarizer', 800, 170, 0, { axis: 90 }),
        m1.d,
        m1.lamp,
        el('label', 1500, 170, 0, { text: 'Crossed polarizers (0° then 90°): nothing gets through.', size: 15, width: 380 }),

        el('laser', 160, 410, 0, { wavelength: 600, polarization: -1 }),
        el('polarizer', 450, 410, 0, { axis: 0 }),
        el('polarizer', 625, 410, 0, { axis: 45 }),
        el('polarizer', 800, 410, 0, { axis: 90 }),
        m2.d,
        m2.lamp,
        el('label', 1500, 410, 0, { text: 'Add a 45° polarizer IN BETWEEN and light comes back (⅛ of it) — the three-polarizer paradox.', size: 15, width: 380 }),

        el('laser', 160, 680, 0, { wavelength: 532, polarization: 0 }),
        el('waveplate', 450, 680, 0, { kind: 'half', axis: 22.5 }),
        el('pbs', 820, 680, 0, { size: 64 }),
        m3a.d,
        m3a.lamp,
        m3b.d,
        m3b.lamp,
        el('label', 1500, 680, 0, { text: 'λ/2 plate at 22.5° rotates the polarization to 45°. The PBS cube sends half straight on and half up. Rotate the plate to steer the power.', size: 15, width: 380 }),

        el('laser', 160, 950, 0, { wavelength: 450, polarization: 0 }),
        el('waveplate', 450, 950, 0, { kind: 'quarter', axis: 45 }),
        el('polarizer', 800, 950, 0, { axis: 90 }),
        m4.d,
        m4.lamp,
        el('label', 1500, 950, 0, { text: 'λ/4 plate at 45° makes circular light: any polarizer angle passes exactly half.', size: 15, width: 380 }),
      ],
      [m1.w, m2.w, m3a.w, m3b.w, m4.w],
    );
  },
};

export default preset;
