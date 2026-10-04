import { Cable } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { lead, makeLabel } from '../kit/device';
import { particleWorld, type PipeProps } from '../particles/world';
import { metalGradient } from '../render/style';
import { graphicsView } from '../render/viewkit';

/**
 * Pipe with a valve between two chambers. Drop each end on a chamber wall;
 * molecules that reach the mouth travel to the other chamber, so pressure
 * equalises and gases effuse at the rate physics gives them.
 */
const pipe: ElementDef<PipeProps> = {
  type: 'pipe',
  label: 'Pipe + valve',
  icon: Cable,
  category: 'matter',
  order: 1,
  description: 'Connects two chambers: drag each end (◆) onto a chamber wall. Click to open/close the valve, or wire its control input.',
  defaults: () => ({ dx: 200, dy: 0, bore: 40, open: true }),
  normalize: (p) => ({ ...p, bore: clamp(p.bore, 8, 200) }),
  params: [
    { kind: 'boolean', key: 'open', label: 'Valve open' },
    { kind: 'number', key: 'bore', label: 'Bore (px)', min: 8, max: 200, step: 1 },
  ],
  info: (_p, id) => {
    // Same keys every time: the inspector binds them once.
    const link = particleWorld.pipe(id);
    const end = (e: unknown) => (e ? 'connected' : 'loose');
    return {
      Ends: link ? `${end(link.a)} / ${end(link.b)}` : '—',
      Valve: link?.open ? 'open' : 'closed',
      Flow: link ? `${link.flow.toFixed(1)} /s (start → end)` : '—',
    };
  },
  liveInfo: true,
  activate: (p) => ({ open: !p.open }),
  clickActivate: false,
  rotatable: false,

  boundsRadius: (p) => Math.hypot(p.dx, p.dy) / 2 + p.bore / 2 + 4,
  hitTest: (p, l) => {
    const len2 = p.dx * p.dx + p.dy * p.dy || 1;
    const t = clamp((l.x * p.dx + l.y * p.dy) / len2, 0, 1);
    return Math.hypot(l.x - p.dx * t, l.y - p.dy * t) <= p.bore / 2 + 6;
  },
  handles: (p) => [{ id: 'end', position: { x: p.dx, y: p.dy }, drag: (_p, l) => ({ dx: l.x, dy: l.y }) }],
  ports: (p) => [{ id: 'ctrl', dir: 'in', position: { x: p.dx / 2, y: p.dy / 2 + p.bore / 2 + 26 }, normal: { x: 0, y: 1 }, label: 'valve' }],
  logic: ({ id, props, inputs, wired }) => {
    particleWorld.setValve(id, props.open && (!wired.ctrl || !!inputs.ctrl));
    return {};
  },

  createView: () => {
    const flowLabel = makeLabel(9, 0x9aa5ba);
    return graphicsView<PipeProps>(
      (g, p, state, el) => {
        const link = particleWorld.pipe(el.id);
        const open = link?.open ?? p.open;
        const len = Math.hypot(p.dx, p.dy) || 1;
        const nx = -p.dy / len;
        const ny = p.dx / len;
        const half = p.bore / 2 + 4;
        const quad = (k: number) => [0 + nx * k, 0 + ny * k, p.dx + nx * k, p.dy + ny * k, p.dx - nx * k, p.dy - ny * k, 0 - nx * k, 0 - ny * k];
        g.poly(quad(half).map((v, i) => v + (i % 2 ? 5 : 3))).fill({ color: 0x000000, alpha: 0.35 });
        g.poly(quad(half)).fill({ fill: metalGradient() }).stroke({ width: 1, color: 0x1d2129 });
        g.poly(quad(p.bore / 2)).fill({ color: 0x05070a, alpha: 0.9 });
        // End flanges, green when attached to a chamber wall.
        for (const [x, y, end] of [
          [0, 0, link?.a],
          [p.dx, p.dy, link?.b],
        ] as const) {
          g.circle(x, y, 5).fill(end ? 0x6dff9c : 0xff8a5a).stroke({ width: 1, color: 0x000000, alpha: 0.6 });
        }
        // Valve wheel in the middle.
        const mx = p.dx / 2;
        const my = p.dy / 2;
        g.circle(mx, my, half + 6).fill(0x1a1e26).stroke({ width: 2, color: open ? 0x6dff9c : 0xff5a5a });
        g.moveTo(mx - nx * (half + 4), my - ny * (half + 4))
          .lineTo(mx + nx * (half + 4), my + ny * (half + 4))
          .stroke({ width: 3, color: open ? 0x6dff9c : 0xff5a5a });
        if (!open) g.moveTo(mx - (p.dx / len) * 6, my - (p.dy / len) * 6).lineTo(mx + (p.dx / len) * 6, my + (p.dy / len) * 6).stroke({ width: 3, color: 0xff5a5a });
        lead(g, mx, my + half + 6, mx, my + half + 26, !!state.signals.inputs.ctrl);
        flowLabel.position.set(mx, my - half - 16);
        flowLabel.text = link && Math.abs(link.flow) > 0.5 ? `${link.flow > 0 ? '→' : '←'} ${Math.abs(link.flow).toFixed(0)}/s` : '';
      },
      {
        setup: (root) => root.addChild(flowLabel),
        extraKey: (el) => {
          const link = particleWorld.pipe(el.id);
          return link ? `${!!link.a}${!!link.b}${link.open}${Math.round(link.flow)}` : '';
        },
      },
    );
  },
};

export default pipe;
