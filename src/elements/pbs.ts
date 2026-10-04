import { Box } from 'lucide';
import { clamp, rad } from '../core/math';
import type { ElementDef } from '../core/types';
import { polarizingSplitter } from '../optics/materials';
import { rectPoints } from '../optics/shapes';
import { drawGlass } from '../render/style';
import { drawShadow, graphicsView } from '../render/viewkit';

interface PbsProps {
  size: number;
  /** Transmitted polarization axis, degrees (0 = p). */
  axis: number;
}

/** Polarizing beam-splitter cube: p-polarization goes straight through, s reflects 90°. */
const pbs: ElementDef<PbsProps> = {
  type: 'pbs',
  label: 'Polarizing beam splitter',
  icon: Box,
  category: 'photonics',
  order: 2.5,
  description: 'PBS cube: transmits light polarized along its axis, reflects the orthogonal polarization at 90°.',
  defaults: () => ({ size: 60, axis: 0 }),
  normalize: (p) => ({ ...p, size: clamp(p.size, 20, 300) }),
  params: [
    { kind: 'number', key: 'size', label: 'Size', min: 20, max: 300, step: 1 },
    { kind: 'number', key: 'axis', label: 'Pass axis°', min: 0, max: 180, step: 1 },
  ],

  boundsRadius: (p) => p.size * 0.71,
  hitTest: (p, l) => Math.abs(l.x) <= p.size / 2 + 2 && Math.abs(l.y) <= p.size / 2 + 2,
  handles: (p) => [{ id: 'size', position: { x: p.size / 2, y: p.size / 2 }, drag: (_p, l) => ({ size: Math.max(Math.abs(l.x), Math.abs(l.y)) * 2 }) }],
  surfaces: (p) => [
    { kind: 'segment', a: { x: -p.size / 2, y: p.size / 2 }, b: { x: p.size / 2, y: -p.size / 2 }, material: polarizingSplitter(rad(p.axis)) },
  ],

  createView: () =>
    graphicsView<PbsProps>((g, p, state) => {
      const sq = rectPoints(p.size, p.size);
      drawShadow(g, sq);
      drawGlass(g, sq, state.selected);
      g.moveTo(-p.size / 2, p.size / 2).lineTo(p.size / 2, -p.size / 2).stroke({ width: 2, color: 0xc9b8ff, alpha: 0.9 });
      g.moveTo(-p.size / 2 + 3, p.size / 2).lineTo(p.size / 2, -p.size / 2 + 3).stroke({ width: 4, color: 0x9a7cff, alpha: 0.18 });
    }),
};

export default pbs;
