import { Graphics } from 'pixi.js';
import { Circle, Parentheses } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef, Surface } from '../core/types';
import { glass } from '../optics/materials';
import { BulgeCurve } from '../optics/shapes';
import { cauchy } from '../optics/spectrum';
import { drawGlass, drawHighlight } from '../render/style';
import { graphicsView } from '../render/viewkit';

/**
 * Thick glass lens with two independently shaped faces.
 * Each face's bulge: + is convex (bulges outward), − is concave, 0 is flat.
 */
interface LensProps {
  height: number;
  /** Thickness at the rim. */
  thickness: number;
  left: number;
  right: number;
  ior: number;
  dispersion: number;
}

function geometry(p: LensProps) {
  const h = p.height / 2;
  const t = p.thickness;
  return {
    h,
    t,
    leftFace: new BulgeCurve(-t / 2, h, -p.left),
    rightFace: new BulgeCurve(t / 2, h, p.right),
  };
}

/** Thick-lens focal length at the base index (lensmaker's equation). */
function focalLength(p: LensProps): number {
  const { leftFace, rightFace } = geometry(p);
  const n = p.ior;
  const R1 = leftFace.signedRadius;
  const R2 = rightFace.signedRadius;
  const d = p.thickness + p.left + p.right;
  const inv = (r: number) => (Number.isFinite(r) ? 1 / r : 0);
  const power = (n - 1) * (inv(R1) - inv(R2) + ((n - 1) * d * inv(R1) * inv(R2)) / n);
  return Math.abs(power) < 1e-7 ? Infinity : 1 / power;
}

const lens: ElementDef<LensProps> = {
  type: 'lens',
  label: 'Lens',
  icon: Circle,
  category: 'optic',
  order: 2,
  description: 'Glass lens. Drag the diamond on each face to make it convex, flat or concave.',
  variants: [
    { label: 'Convex lens', icon: Circle, props: { left: 22, right: 22, thickness: 8 } },
    { label: 'Concave lens', icon: Parentheses, props: { left: -18, right: -18, thickness: 44 } },
    { label: 'Plano-convex lens', props: { left: 0, right: 28, thickness: 8 } },
  ],
  defaults: () => ({ height: 170, thickness: 8, left: 22, right: 22, ior: 1.5, dispersion: 0.6 }),
  normalize: (p) => {
    const height = clamp(p.height, 30, 600);
    const lim = (height / 2) * 0.95;
    const left = clamp(p.left, -lim, lim);
    const right = clamp(p.right, -lim, lim);
    // Keep at least 4px of glass at the centre.
    const thickness = Math.max(clamp(p.thickness, 2, 300), 4 - left - right);
    return { ...p, height, left, right, thickness };
  },
  params: [
    { kind: 'number', key: 'left', label: 'Left face', min: -280, max: 280, step: 1 },
    { kind: 'number', key: 'right', label: 'Right face', min: -280, max: 280, step: 1 },
    { kind: 'number', key: 'thickness', label: 'Rim thickness', min: 2, max: 300, step: 1 },
    { kind: 'number', key: 'height', label: 'Height', min: 30, max: 600, step: 1 },
    { kind: 'number', key: 'ior', label: 'Refractive index', min: 1, max: 2.5, step: 0.01 },
    { kind: 'number', key: 'dispersion', label: 'Dispersion', min: 0, max: 4, step: 0.05 },
  ],
  info: (p) => {
    const f = focalLength(p);
    if (!Number.isFinite(f)) return { Type: 'Window (no focus)', Focus: '∞' };
    return { Type: f > 0 ? 'Converging' : 'Diverging', Focus: `${Math.round(f)} px` };
  },

  boundsRadius: (p) => Math.max(p.height / 2, p.thickness / 2 + Math.max(0, p.left, p.right)) + 2,
  hitTest: (p, l) => {
    const { h, leftFace, rightFace } = geometry(p);
    return Math.abs(l.y) <= h + 2 && l.x >= leftFace.xAt(l.y) - 4 && l.x <= rightFace.xAt(l.y) + 4;
  },
  handles: (p) => {
    const t = p.thickness;
    return [
      { id: 'left', position: { x: -t / 2 - p.left, y: 0 }, drag: (_p, l) => ({ left: -(l.x + t / 2) }) },
      { id: 'right', position: { x: t / 2 + p.right, y: 0 }, drag: (_p, l) => ({ right: l.x - t / 2 }) },
      { id: 'height', position: { x: 0, y: -p.height / 2 }, drag: (_p, l) => ({ height: Math.abs(l.y) * 2 }) },
      { id: 'thickness', position: { x: t / 2, y: p.height / 2 }, drag: (_p, l) => ({ thickness: Math.abs(l.x) * 2 }) },
    ];
  },
  surfaces: (p): Surface[] => {
    const { h, t, leftFace, rightFace } = geometry(p);
    const mat = glass(cauchy(p.ior, p.dispersion));
    return [
      leftFace.surface(mat, { x: -1, y: 0 }),
      rightFace.surface(mat, { x: 1, y: 0 }),
      { kind: 'segment', a: { x: -t / 2, y: -h }, b: { x: t / 2, y: -h }, material: mat, orient: { x: 0, y: -1 } },
      { kind: 'segment', a: { x: -t / 2, y: h }, b: { x: t / 2, y: h }, material: mat, orient: { x: 0, y: 1 } },
    ];
  },

  createView: () => {
    const focus = new Graphics();
    return graphicsView<LensProps>(
      (g, p, state) => {
        const { leftFace, rightFace } = geometry(p);
        const outline = [...rightFace.sample(36), ...leftFace.sample(36).reverse()];
        g.poly(outline.flatMap((q) => [q.x + 3, q.y + 5])).fill({ color: 0x000000, alpha: 0.18 });
        drawGlass(g, outline, state.selected);
        const inset = leftFace.sample(36).slice(6, 18).map((q) => ({ x: q.x + 3.5, y: q.y }));
        drawHighlight(g, inset, 0.45);

        focus.clear();
        const f = focalLength(p);
        if (state.selected && Number.isFinite(f) && Math.abs(f) < 3000) {
          focus.moveTo(-Math.abs(f) - 20, 0).lineTo(Math.abs(f) + 20, 0).stroke({ width: 1, color: 0x8fb4ff, alpha: 0.25 });
          for (const x of [f, -f]) {
            focus.circle(x, 0, 4).stroke({ width: 1.5, color: 0x8fb4ff, alpha: 0.8 });
            focus.circle(x, 0, 1.5).fill(0x8fb4ff);
          }
        }
      },
      { setup: (root) => root.addChild(focus) },
    );
  },
};

export default lens;
