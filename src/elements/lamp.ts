import { Sprite } from 'pixi.js';
import { Lightbulb } from 'lucide';
import type { ElementDef } from '../core/types';
import { lead } from '../kit/device';
import { graphicsView } from '../render/viewkit';

interface LampProps {
  color: number;
  /** Counts toward "all goals complete" when lit. */
  goal: boolean;
  /** As a goal: must be OFF instead of ON. */
  goalOff: boolean;
}

const R = 13;
const COLORS: Record<string, number> = { Amber: 0xffb347, Red: 0xff4d4d, Green: 0x5cff8a, Blue: 0x4dc3ff, White: 0xf4f6ff, Purple: 0xb07bff };

/** Indicator lamp driven by a wire. */
const lamp: ElementDef<LampProps> = {
  type: 'lamp',
  label: 'Indicator lamp',
  icon: Lightbulb,
  category: 'io',
  order: 4,
  description: 'Lights up while its input is ON. Can be marked as a puzzle goal.',
  defaults: () => ({ color: COLORS.Amber, goal: false, goalOff: false }),
  params: [
    { kind: 'select', key: 'color', label: 'Colour', options: COLORS },
    { kind: 'boolean', key: 'goal', label: 'Puzzle goal' },
    { kind: 'boolean', key: 'goalOff', label: 'Goal is OFF' },
  ],
  rotatable: false,
  goalMet: (p, _e, sig) => (p.goal ? !!sig.inputs.in !== p.goalOff : null),

  boundsRadius: () => R + 4,
  hitTest: (_p, l) => Math.hypot(l.x, l.y) <= R + 4,
  ports: () => [{ id: 'in', dir: 'in', position: { x: -R - 12, y: 0 }, normal: { x: -1, y: 0 } }],

  createView: ({ textures }) => {
    let glow: Sprite;
    let level = 0;
    return graphicsView<LampProps>(
      (g, p, state) => {
        const on = !!state.signals.inputs.in;
        g.circle(2, 4, R + 3).fill({ color: 0x000000, alpha: 0.4 });
        g.circle(0, 0, R + 3).fill(0x10141b).stroke({ width: 1.4, color: p.goal ? 0xffc864 : 0x3a4252 });
        g.circle(0, 0, R).fill(on ? p.color : 0x1d222b).stroke({ width: 1, color: on ? 0xffffff : 0x2f3644, alpha: 0.6 });
        g.circle(-4, -4, 4).fill({ color: 0xffffff, alpha: on ? 0.55 : 0.12 });
        lead(g, -R - 3, 0, -R - 12, 0, on);
      },
      {
        setup: (root) => {
          glow = new Sprite(textures.glow);
          glow.anchor.set(0.5);
          glow.blendMode = 'add';
          root.addChild(glow);
        },
        update: (el) => {
          glow.tint = el.props.color;
        },
        tick: (dt, _el, state) => {
          const target = state.signals.inputs.in ? 1 : 0;
          level += (target - level) * Math.min(1, dt * 14);
          glow.alpha = level;
          glow.scale.set((R * 7) / 256);
        },
      },
    );
  },
};

export default lamp;
