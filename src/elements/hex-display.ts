import { Binary } from 'lucide';
import type { ElementDef } from '../core/types';
import { deviceBox, lead } from '../kit/device';
import { portColumn } from '../logic/ports';
import { graphicsView } from '../render/viewkit';

interface HexProps {
  color: number;
}

const W = 60;
const H = 84;
const BITS = ['b0', 'b1', 'b2', 'b3'];

// Segments a..g for 0–F.
const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71];

/** 7-segment display showing a 4-bit binary input as a hex digit. */
const hexDisplay: ElementDef<HexProps> = {
  type: 'hex-display',
  label: 'Hex display',
  icon: Binary,
  category: 'io',
  order: 5,
  description: '7-segment display: shows inputs b0 (1) … b3 (8) as one hex digit 0–F.',
  defaults: () => ({ color: 0xff4d4d }),
  params: [{ kind: 'select', key: 'color', label: 'Colour', options: { Red: 0xff4d4d, Green: 0x5cff8a, Cyan: 0x3ee8ff, Amber: 0xffb347 } }],

  boundsRadius: () => Math.hypot(W, H) / 2,
  hitTest: (_p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= H / 2 + 2,
  ports: () => portColumn(BITS, 'in', -W / 2 - 12, 18, ['bit 0 (value 1)', 'bit 1 (value 2)', 'bit 2 (value 4)', 'bit 3 (value 8)']),

  createView: () =>
    graphicsView<HexProps>((g, p, state) => {
      const bits = BITS.map((b) => !!state.signals.inputs[b]);
      const value = bits.reduce((v, b, i) => v | (b ? 1 << i : 0), 0);
      const mask = DIGITS[value];
      deviceBox(g, W, H, 6);
      g.roundRect(-W / 2 + 8, -H / 2 + 8, W - 16, H - 16, 4).fill(0x050608);
      const sx = 14;
      const sy = 26;
      const t = 4.5;
      // [x, y, horizontal]
      const segs: [number, number, boolean][] = [
        [0, -sy, true],
        [sx, -sy / 2, false],
        [sx, sy / 2, false],
        [0, sy, true],
        [-sx, sy / 2, false],
        [-sx, -sy / 2, false],
        [0, 0, true],
      ];
      segs.forEach(([x, y, horiz], i) => {
        const on = (mask >> i) & 1;
        const color = on ? p.color : 0x1a1d24;
        if (horiz) g.poly([x - sx + 3, y, x - sx + 3 + t / 2, y - t / 2, x + sx - 3 - t / 2, y - t / 2, x + sx - 3, y, x + sx - 3 - t / 2, y + t / 2, x - sx + 3 + t / 2, y + t / 2]).fill(color);
        else g.poly([x, y - sy / 2 + 3, x + t / 2, y - sy / 2 + 3 + t / 2, x + t / 2, y + sy / 2 - 3 - t / 2, x, y + sy / 2 - 3, x - t / 2, y + sy / 2 - 3 - t / 2, x - t / 2, y - sy / 2 + 3 + t / 2]).fill(color);
        if (on) {
          if (horiz) g.rect(x - sx + 2, y - t, 2 * sx - 4, 2 * t).fill({ color: p.color, alpha: 0.12 });
          else g.rect(x - t, y - sy / 2 + 2, 2 * t, sy - 4).fill({ color: p.color, alpha: 0.12 });
        }
      });
      BITS.forEach((_b, i) => {
        const y = (i - 1.5) * 18;
        lead(g, -W / 2, y, -W / 2 - 12, y, bits[i]);
      });
    }),
};

export default hexDisplay;
