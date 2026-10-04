import { BrickWall } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { absorber } from '../optics/materials';
import { rectSurfaces } from '../optics/shapes';
import { COLORS } from '../render/style';
import { graphicsView } from '../render/viewkit';

interface WallProps {
  width: number;
  height: number;
}

const wall: ElementDef<WallProps> = {
  type: 'wall',
  label: 'Blocker',
  icon: BrickWall,
  category: 'obstacle',
  description: 'Matte block that absorbs light. Drag the corner handle to resize.',
  defaults: () => ({ width: 40, height: 160 }),
  normalize: (p) => ({ width: clamp(p.width, 8, 1200), height: clamp(p.height, 8, 1200) }),
  params: [
    { kind: 'number', key: 'width', label: 'Width', min: 8, max: 1200, step: 1 },
    { kind: 'number', key: 'height', label: 'Height', min: 8, max: 1200, step: 1 },
  ],

  boundsRadius: (p) => Math.hypot(p.width, p.height) / 2,
  hitTest: (p, l) => Math.abs(l.x) <= p.width / 2 + 2 && Math.abs(l.y) <= p.height / 2 + 2,
  handles: (p) => [
    { id: 'corner', position: { x: p.width / 2, y: p.height / 2 }, drag: (_p, l) => ({ width: Math.abs(l.x) * 2, height: Math.abs(l.y) * 2 }) },
  ],
  surfaces: (p) => rectSurfaces(p.width, p.height, absorber),

  createView: () =>
    graphicsView<WallProps>((g, p) => {
      const { width: w, height: h } = p;
      g.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 4).fill({ color: 0x000000, alpha: 0.45 });
      g.roundRect(-w / 2, -h / 2, w, h, 4).fill(COLORS.matte).stroke({ width: 1.2, color: COLORS.matteEdge });
      g.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 2).stroke({ width: 1, color: 0x000000, alpha: 0.6 });
      g.moveTo(-w / 2 + 3, -h / 2 + 1.5).lineTo(w / 2 - 3, -h / 2 + 1.5).stroke({ width: 1, color: 0xffffff, alpha: 0.12 });
      if (w >= 16 && h >= 16)
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.circle((sx * w) / 2 - sx * 7, (sy * h) / 2 - sy * 7, 1.6).fill(0x4a5262);
    }),
};

export default wall;
