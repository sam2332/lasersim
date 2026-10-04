import { Triangle } from 'lucide';
import { clamp, type Vec2 } from '../core/math';
import type { ElementDef } from '../core/types';
import { glass } from '../optics/materials';
import { pointInPolygon, polygonSurfaces } from '../optics/shapes';
import { cauchy } from '../optics/spectrum';
import { drawGlass, drawHighlight } from '../render/style';
import { drawShadow, graphicsView } from '../render/viewkit';

interface PrismProps {
  size: number;
  ior: number;
  dispersion: number;
}

/** Equilateral triangle centred on its centroid, apex pointing up (-y). */
function vertices(p: PrismProps): Vec2[] {
  const R = p.size / Math.sqrt(3);
  return [-90, 30, 150].map((a) => ({ x: R * Math.cos((a * Math.PI) / 180), y: R * Math.sin((a * Math.PI) / 180) }));
}

const prism: ElementDef<PrismProps> = {
  type: 'prism',
  label: 'Prism',
  icon: Triangle,
  category: 'optic',
  order: 3,
  description: 'Dispersive glass prism — splits white light into a spectrum.',
  defaults: () => ({ size: 130, ior: 1.5, dispersion: 2 }),
  normalize: (p) => ({ ...p, size: clamp(p.size, 30, 600) }),
  params: [
    { kind: 'number', key: 'size', label: 'Size', min: 30, max: 600, step: 1 },
    { kind: 'number', key: 'ior', label: 'Refractive index', min: 1, max: 2.5, step: 0.01 },
    { kind: 'number', key: 'dispersion', label: 'Dispersion', min: 0, max: 6, step: 0.05 },
  ],

  boundsRadius: (p) => p.size / Math.sqrt(3) + 2,
  hitTest: (p, l) => pointInPolygon(l, vertices(p)),
  handles: (p) => [{ id: 'size', position: vertices(p)[0], drag: (_p, l) => ({ size: Math.hypot(l.x, l.y) * Math.sqrt(3) }) }],
  surfaces: (p) => polygonSurfaces(vertices(p), glass(cauchy(p.ior, p.dispersion))),

  createView: () =>
    graphicsView<PrismProps>((g, p, state) => {
      const v = vertices(p);
      drawShadow(g, v);
      drawGlass(g, v, state.selected);
      const inset = (a: Vec2, b: Vec2, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      const c = { x: 0, y: 0 };
      drawHighlight(g, [inset(inset(v[0], c, 0.12), inset(v[2], c, 0.12), 0.15), inset(inset(v[0], c, 0.12), inset(v[2], c, 0.12), 0.6)], 0.5);
    }),
};

export default prism;
