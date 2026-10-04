import { ToggleRight } from 'lucide';
import type { ElementDef } from '../core/types';
import { deviceBox, lead, SIGNAL_ON } from '../kit/device';
import { graphicsView } from '../render/viewkit';

interface SwitchProps {
  on: boolean;
}

const W = 46;
const H = 26;

/** Manual toggle switch — click it to flip. */
const toggle: ElementDef<SwitchProps> = {
  type: 'switch',
  label: 'Toggle switch',
  icon: ToggleRight,
  category: 'io',
  order: 1,
  description: 'Click to flip between OFF and ON.',
  defaults: () => ({ on: false }),
  params: [{ kind: 'boolean', key: 'on', label: 'On' }],
  activate: (p) => ({ on: !p.on }),
  clickActivate: true,

  boundsRadius: () => W / 2 + 2,
  hitTest: (_p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= H / 2 + 2,
  ports: () => [{ id: 'out', dir: 'out', position: { x: W / 2 + 10, y: 0 }, normal: { x: 1, y: 0 } }],
  logic: ({ props }) => ({ out: props.on }),

  createView: () =>
    graphicsView<SwitchProps>((g, p) => {
      deviceBox(g, W, H, 13);
      const tx = p.on ? 9 : -9;
      g.roundRect(-17, -7, 34, 14, 7).fill(p.on ? 0x0f4a55 : 0x1a1e26).stroke({ width: 1, color: p.on ? SIGNAL_ON : 0x3a4252 });
      if (p.on) g.roundRect(-17, -7, 34, 14, 7).fill({ color: SIGNAL_ON, alpha: 0.18 });
      g.circle(tx, 0, 6).fill(0xe8eef8).stroke({ width: 1, color: 0x000000, alpha: 0.4 });
      lead(g, W / 2, 0, W / 2 + 10, 0, p.on);
    }),
};

export default toggle;
