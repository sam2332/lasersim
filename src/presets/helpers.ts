import { rad } from '../core/math';
import { makeElement } from '../core/store';
import type { Props, Scene, SceneElement } from '../core/types';

export const BOARD = { width: 1800, height: 1100 };

/** Shorthand for preset authoring: rotation in degrees. */
export function el(type: string, x: number, y: number, rotationDeg = 0, props: Props = {}, locked = false): SceneElement {
  return makeElement(type, x, y, rad(rotationDeg), props, { locked });
}

export function scene(elements: SceneElement[]): Scene {
  return { version: 1, board: { ...BOARD }, elements };
}
