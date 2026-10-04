import { ScanEye } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef, Surface } from '../core/types';
import { deviceBox, lead, led, makeLabel } from '../kit/device';
import { absorber, colorSensor, sensor } from '../optics/materials';
import { beamColor } from '../optics/spectrum';
import { graphicsView } from '../render/viewkit';

interface DetectorProps {
  /** Light power needed to switch the output on (1 = one full beam). */
  threshold: number;
  /** Only count light near `wavelength`. */
  colorMatch: boolean;
  wavelength: number;
}

const W = 30;
const H = 36;

/**
 * Photodetector: light enters the window on the left (-x), the signal leaves on the right.
 * Two beams + threshold > 1 make an optical AND; threshold < 1 an OR.
 */
const detector: ElementDef<DetectorProps> = {
  type: 'detector',
  label: 'Photodetector',
  icon: ScanEye,
  category: 'io',
  order: 0,
  description: 'Light enters the window on the left; outputs ON while it reaches the threshold. Use the colour filter for wavelength-selective logic.',
  variants: [
    { label: 'Photodetector', props: { colorMatch: false } },
    { label: 'Colour detector', props: { colorMatch: true, wavelength: 532 } },
  ],
  defaults: () => ({ threshold: 0.3, colorMatch: false, wavelength: 532 }),
  normalize: (p) => ({ ...p, threshold: clamp(p.threshold, 0.01, 10) }),
  params: [
    { kind: 'number', key: 'threshold', label: 'Threshold', min: 0.01, max: 4, step: 0.01 },
    { kind: 'boolean', key: 'colorMatch', label: 'Colour filter' },
    { kind: 'wavelength', key: 'wavelength', label: 'Filter colour' },
  ],

  boundsRadius: () => Math.hypot(W, H) / 2,
  hitTest: (_p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= H / 2 + 2,
  ports: () => [{ id: 'out', dir: 'out', position: { x: W / 2 + 10, y: 0 }, normal: { x: 1, y: 0 }, label: 'light detected' }],
  surfaces: (p): Surface[] => {
    const window = p.colorMatch ? colorSensor(p.wavelength, 30) : sensor;
    return [
      { kind: 'segment', a: { x: -W / 2, y: -H / 2 }, b: { x: -W / 2, y: H / 2 }, material: window, orient: { x: -1, y: 0 } },
      { kind: 'segment', a: { x: -W / 2, y: -H / 2 }, b: { x: W / 2, y: -H / 2 }, material: absorber },
      { kind: 'segment', a: { x: -W / 2, y: H / 2 }, b: { x: W / 2, y: H / 2 }, material: absorber },
      { kind: 'segment', a: { x: W / 2, y: -H / 2 }, b: { x: W / 2, y: H / 2 }, material: absorber },
    ];
  },
  logic: ({ props, energy }) => ({ out: energy >= props.threshold }),

  createView: () => {
    const reading = makeLabel(8, 0x9aa5ba);
    return graphicsView<DetectorProps>(
      (g, p, state) => {
        const on = !!state.signals.outputs.out;
        deviceBox(g, W, H, 5, on ? 0x3ee8ff : undefined);
        // Front window.
        const tint = p.colorMatch ? beamColor(p.wavelength) : 0x3a6ea8;
        g.roundRect(-W / 2 + 1, -H / 2 + 5, 6, H - 10, 2).fill({ color: tint, alpha: 0.55 + Math.min(0.4, state.energy * 0.4) }).stroke({ width: 1, color: 0xcfe6ff, alpha: 0.7 });
        g.circle(-W / 2 + 4, 0, 3).fill({ color: 0xffffff, alpha: Math.min(1, state.energy) * 0.9 });
        led(g, W / 2 - 7, -H / 2 + 7, on);
        lead(g, W / 2, 0, W / 2 + 10, 0, on);
        reading.text = state.energy.toFixed(2);
      },
      {
        setup: (root) => {
          reading.position.set(3, H / 2 - 8);
          root.addChild(reading);
        },
      },
    );
  },
};

export default detector;
