import { FillGradient, type Graphics } from 'pixi.js';
import type { Vec2 } from '../core/math';

/** Shared look & feel so every element feels like part of one set. */

export const COLORS = {
  accent: 0x8fb4ff,
  glassRim: 0xd9f3ff,
  metalEdge: 0xf2f6ff,
  matte: 0x161a22,
  matteEdge: 0x3a4250,
  gold: 0xffc864,
};

export const flat = (pts: Vec2[]): number[] => pts.flatMap((p) => [p.x, p.y]);

let glassGrad: FillGradient | null = null;
let metalGrad: FillGradient | null = null;
let bodyGrad: FillGradient | null = null;

/** Diagonal sheen used for all glass bodies (in the shape's local bounding box). */
function glassGradient(): FillGradient {
  return (glassGrad ??= new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: 'rgba(200,235,255,0.30)' },
      { offset: 0.45, color: 'rgba(140,200,255,0.10)' },
      { offset: 0.55, color: 'rgba(180,220,255,0.16)' },
      { offset: 1, color: 'rgba(90,150,230,0.22)' },
    ],
  }));
}

/** Brushed-metal bands across the short axis. */
export function metalGradient(): FillGradient {
  return (metalGrad ??= new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: '#5d6573' },
      { offset: 0.35, color: '#e9eef7' },
      { offset: 0.55, color: '#aab3c2' },
      { offset: 1, color: '#3d4350' },
    ],
  }));
}

/** Dark anodized device body, lit from above. */
export function bodyGradient(): FillGradient {
  return (bodyGrad ??= new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: '#4a5160' },
      { offset: 0.12, color: '#262b35' },
      { offset: 0.8, color: '#12151b' },
      { offset: 1, color: '#07080b' },
    ],
  }));
}

/** Glass body: tinted fill, bright rim and an inner specular line. */
export function drawGlass(g: Graphics, outline: Vec2[], selected = false): void {
  g.poly(flat(outline)).fill({ fill: glassGradient() });
  g.poly(flat(outline)).stroke({ width: 4, color: 0x7fc8ff, alpha: 0.12, join: 'round' });
  g.poly(flat(outline)).stroke({ width: 1.4, color: COLORS.glassRim, alpha: selected ? 1 : 0.8, join: 'round' });
}

/** A soft specular streak along a polyline (inset highlights on glass). */
export function drawHighlight(g: Graphics, pts: Vec2[], alpha = 0.35): void {
  if (pts.length < 2) return;
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke({ width: 1.2, color: 0xffffff, alpha, cap: 'round', join: 'round' });
}

export function polyline(g: Graphics, pts: Vec2[]): Graphics {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  return g;
}
