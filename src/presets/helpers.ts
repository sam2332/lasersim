import { rad } from '../core/math';
import { makeElement, newId } from '../core/store';
import type { Props, Scene, SceneElement, Wire } from '../core/types';

export const BOARD = { width: 1800, height: 1100 };

/** Shorthand for preset authoring: rotation in degrees. */
export function el(type: string, x: number, y: number, rotationDeg = 0, props: Props = {}, locked = false): SceneElement {
  return makeElement(type, x, y, rad(rotationDeg), props, { locked });
}

/** Connect `from`'s output port to `to`'s input port. */
export function wire(from: SceneElement, fromPort: string, to: SceneElement, toPort: string): Wire {
  return { id: newId(), from: { el: from.id, port: fromPort }, to: { el: to.id, port: toPort } };
}

export function scene(elements: SceneElement[], wires: Wire[] = [], board = BOARD): Scene {
  return { version: 1, board: { ...board }, elements, wires };
}
