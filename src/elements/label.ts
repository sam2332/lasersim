import { Text } from 'pixi.js';
import { Type } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { graphicsView } from '../render/viewkit';

interface LabelProps {
  text: string;
  size: number;
  color: number;
  /** Max line width before wrapping. */
  width: number;
}

const COLORS = { Soft: 0xaab6cc, White: 0xf2f5fb, Gold: 0xffc864, Cyan: 0x3ee8ff, Pink: 0xff7ab6 };

/** Free text on the board — for explaining a setup. Light passes straight through. */
const label: ElementDef<LabelProps> = {
  type: 'label',
  label: 'Text label',
  icon: Type,
  category: 'note',
  description: 'A note on the board. Does not interact with light.',
  defaults: () => ({ text: 'Label', size: 18, color: COLORS.Soft, width: 360 }),
  normalize: (p) => ({ ...p, size: clamp(p.size, 8, 72), width: clamp(p.width, 60, 1600) }),
  params: [
    { kind: 'text', key: 'text', label: 'Text', multiline: true },
    { kind: 'number', key: 'size', label: 'Size', min: 8, max: 72, step: 1 },
    { kind: 'number', key: 'width', label: 'Wrap width', min: 60, max: 1600, step: 10 },
    { kind: 'select', key: 'color', label: 'Colour', options: COLORS },
  ],

  boundsRadius: (p) => Math.min(p.width, p.text.length * p.size * 0.55) / 2 + 6,
  hitTest: (p, l) => {
    const w = Math.min(p.width, p.text.length * p.size * 0.55);
    const lines = Math.max(1, Math.ceil((p.text.length * p.size * 0.55) / p.width) + (p.text.match(/\n/g)?.length ?? 0));
    return Math.abs(l.x) <= w / 2 + 4 && Math.abs(l.y) <= (lines * p.size * 1.3) / 2 + 4;
  },

  createView: () => {
    const text = new Text({
      text: '',
      style: { fontFamily: 'Inter, sans-serif', fontSize: 18, fill: 0xffffff, fontWeight: '500', wordWrap: true, align: 'center', lineHeight: 24 },
      resolution: 3,
    });
    text.anchor.set(0.5);
    return graphicsView<LabelProps>(
      () => {},
      {
        setup: (root) => root.addChild(text),
        update: (el) => {
          const p = el.props;
          text.text = p.text;
          text.style.fontSize = p.size;
          text.style.lineHeight = p.size * 1.3;
          text.style.wordWrapWidth = p.width;
          text.style.fill = p.color;
        },
      },
    );
  },
};

export default label;
