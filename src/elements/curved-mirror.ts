import { Disc } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { mirror } from '../optics/materials';
import { BulgeCurve } from '../optics/shapes';
import { polyline } from '../render/style';
import { graphicsView } from '../render/viewkit';

interface CurvedMirrorProps {
  height: number;
  /** Positive = concave toward +x (focusing), negative = convex. */
  depth: number;
}

const curve = (p: CurvedMirrorProps) => new BulgeCurve(0, p.height / 2, -p.depth);

/** Spherical (arc) mirror — focuses or spreads light. */
const curvedMirror: ElementDef<CurvedMirrorProps> = {
  type: 'curved-mirror',
  label: 'Curved mirror',
  icon: Disc,
  category: 'optic',
  order: 1,
  description: 'Arc mirror. Drag the centre handle to change the curve (concave focuses, convex spreads).',
  defaults: () => ({ height: 170, depth: 26 }),
  normalize: (p) => {
    const height = clamp(p.height, 30, 700);
    return { height, depth: clamp(p.depth, -height * 0.475, height * 0.475) };
  },
  params: [
    { kind: 'number', key: 'height', label: 'Size', min: 30, max: 700, step: 1 },
    { kind: 'number', key: 'depth', label: 'Curve', min: -160, max: 160, step: 1 },
  ],
  info: (p) => {
    const c = curve(p);
    if (c.flat) return { Type: 'Flat', Focus: '∞' };
    return { Type: p.depth > 0 ? 'Concave' : 'Convex', Focus: `${Math.round(c.r / 2)} px` };
  },

  boundsRadius: (p) => Math.max(p.height / 2, Math.abs(p.depth)) + 4,
  hitTest: (p, l) => Math.abs(l.y) <= p.height / 2 + 3 && Math.abs(l.x - curve(p).xAt(l.y)) <= 8,
  handles: (p) => [
    { id: 'depth', position: { x: -p.depth, y: 0 }, drag: (_p, l) => ({ depth: -l.x }) },
    { id: 'size', position: { x: 0, y: p.height / 2 }, drag: (_p, l) => ({ height: Math.abs(l.y) * 2 }) },
  ],
  surfaces: (p) => [curve(p).surface(mirror(0.97))],

  createView: () =>
    graphicsView<CurvedMirrorProps>((g, p) => {
      const pts = curve(p).sample(40);
      const back = pts.map((q) => ({ x: q.x - 4, y: q.y }));
      polyline(g, pts.map((q) => ({ x: q.x + 1, y: q.y + 5 }))).stroke({ width: 9, color: 0x000000, alpha: 0.35, cap: 'round' });
      polyline(g, back).stroke({ width: 8, color: 0x3d4350, cap: 'round', join: 'round' });
      polyline(g, pts.map((q) => ({ x: q.x - 2, y: q.y }))).stroke({ width: 5, color: 0xb9c2d2, cap: 'round', join: 'round' });
      polyline(g, pts).stroke({ width: 1.4, color: 0xffffff, alpha: 0.95, cap: 'round', join: 'round' });
    }),
};

export default curvedMirror;
