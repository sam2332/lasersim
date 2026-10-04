import { Text, type Graphics } from 'pixi.js';
import { clamp, type Vec2 } from '../core/math';
import type { ElementDef, Material, ParamSpec, Port, Signals, ViewState } from '../core/types';
import { graphicsView } from '../render/viewkit';

/**
 * Factory for thin flat optical components (polarizers, wave plates,
 * dichroics, gratings…). A plate is a segment along local y at x = 0; light
 * crossing it is handed to the plate's material.
 */
export interface PlateProps {
  length: number;
}

export interface PlateOptions<P extends PlateProps> extends Omit<ElementDef<P>, 'boundsRadius' | 'hitTest' | 'createView' | 'surfaces' | 'handles'> {
  /** Material for the current props/signals; null makes the plate transparent. */
  material(p: P, signals: Signals): Material | null;
  /** Orient the normal toward +x (needed by direction-sensitive materials). */
  directional?: boolean;
  look: { color: number; alpha: number; thickness?: number; edge?: number };
  /** Short label drawn on a badge next to the plate (e.g. "λ/4"). */
  badge?: (p: P) => string;
  /** Angle (radians) of an axis line drawn in the badge. */
  badgeAxis?: (p: P) => number | null;
  decorate?(g: Graphics, p: P, state: ViewState): void;
}

export const lengthParam = <P extends PlateProps>(): ParamSpec<P> => ({ kind: 'number', key: 'length' as keyof P & string, label: 'Length', min: 20, max: 600, step: 1 });

/** Control input port below the plate. */
export const controlPort = (length: number): Port => ({ id: 'ctrl', dir: 'in', position: { x: 0, y: length / 2 + 14 }, normal: { x: 0, y: 1 }, label: 'control' });

/** Whether a controlled element is active (unwired = active). */
export const powered = (sig: Signals, invert = false): boolean => {
  const v = sig.wired.ctrl ? !!sig.inputs.ctrl : true;
  return invert ? !v : v;
};

export function plate<P extends PlateProps>(o: PlateOptions<P>): ElementDef<P> {
  const T = o.look.thickness ?? 6;
  const userNormalize = o.normalize;
  return {
    ...o,
    normalize: (p) => {
      const q = { ...p, length: clamp(p.length, 20, 600) };
      return userNormalize ? userNormalize(q) : q;
    },
    params: [...o.params, lengthParam<P>()],
    boundsRadius: (p) => p.length / 2 + 4,
    hitTest: (p, l) => Math.abs(l.x) <= T / 2 + 5 && Math.abs(l.y) <= p.length / 2 + 3,
    handles: (p) => [{ id: 'end', position: { x: 0, y: -p.length / 2 }, drag: (_p, l: Vec2) => ({ length: Math.abs(l.y) * 2 }) as Partial<P> }],
    surfaces: (p, sig) => {
      const material = o.material(p, sig);
      if (!material) return [];
      return [
        {
          kind: 'segment',
          a: { x: 0, y: -p.length / 2 },
          b: { x: 0, y: p.length / 2 },
          material,
          orient: o.directional ? { x: 1, y: 0 } : undefined,
        },
      ];
    },
    createView: () => {
      const label = new Text({ text: '', style: { fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: '600', fill: 0xdfe7f5 }, resolution: 4 });
      label.anchor.set(0.5);
      return graphicsView<P>(
        (g, p, state) => {
          const L = p.length;
          g.roundRect(-T / 2 + 3, -L / 2 + 5, T, L, 2).fill({ color: 0x000000, alpha: 0.3 });
          g.roundRect(-T / 2, -L / 2, T, L, 2)
            .fill({ color: o.look.color, alpha: o.look.alpha })
            .stroke({ width: 1, color: o.look.edge ?? 0xd9f3ff, alpha: 0.85 });
          g.moveTo(-T / 2 + 1.5, -L / 2 + 4).lineTo(-T / 2 + 1.5, L / 2 - 4).stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
          g.roundRect(-T / 2 - 1.5, -L / 2 - 2, T + 3, 5, 2).fill(0x2a2f39);
          g.roundRect(-T / 2 - 1.5, L / 2 - 3, T + 3, 5, 2).fill(0x2a2f39);

          const text = o.badge?.(p);
          const axis = o.badgeAxis?.(p);
          label.visible = !!text;
          if (text || axis != null) {
            const by = -L / 2 - 16;
            g.circle(0, by, 10).fill({ color: 0x0b0e14, alpha: 0.9 }).stroke({ width: 1.2, color: 0x56607a });
            if (axis != null) {
              const c = Math.cos(axis) * 7;
              const s = Math.sin(axis) * 7;
              g.moveTo(-c, by - s).lineTo(c, by + s).stroke({ width: 1.8, color: 0x8fb4ff, cap: 'round' });
            }
            if (text) {
              label.text = text;
              label.position.set(axis != null ? 14 : 0, by);
              label.anchor.set(axis != null ? 0 : 0.5, 0.5);
            }
          }
          o.decorate?.(g, p, state);
        },
        { setup: (root) => root.addChild(label) },
      );
    },
  };
}
