import { Container, Graphics } from 'pixi.js';
import type { Vec2 } from '../core/math';
import type { ElementView, SceneElement, ViewState } from '../core/types';
import { flat } from './style';

/**
 * A view made of one Graphics that redraws only when props, selection, signals
 * or light change. Animated parts add children to `root` via `setup`.
 * `extraKey` lets a view redraw on outside state too (checked every frame).
 */
export function graphicsView<P extends object>(
  draw: (g: Graphics, props: P, state: ViewState, el: SceneElement<P>) => void,
  hooks: {
    setup?: (root: Container) => void;
    update?: (el: SceneElement<P>, state: ViewState) => void;
    tick?: (dt: number, el: SceneElement<P>, state: ViewState) => void;
    extraKey?: (el: SceneElement<P>) => string;
  } = {},
): ElementView<P> {
  const root = new Container();
  const g = new Graphics();
  root.addChild(g);
  hooks.setup?.(root);
  let key = '';
  const refresh = (el: SceneElement<P>, state: ViewState) => {
    const k = JSON.stringify(el.props) + state.selected + JSON.stringify(state.signals) + state.energy.toFixed(2) + (hooks.extraKey?.(el) ?? '');
    if (k !== key) {
      key = k;
      g.clear();
      draw(g, el.props, state, el);
    }
  };
  return {
    root,
    update(el, state) {
      refresh(el, state);
      hooks.update?.(el, state);
    },
    tick(dt, el, state) {
      if (hooks.extraKey) refresh(el, state);
      hooks.tick?.(dt, el, state);
    },
  };
}

/** Soft contact shadow under an outline. */
export function drawShadow(g: Graphics, outline: Vec2[], dx = 3, dy = 5): void {
  g.poly(flat(outline.map((p) => ({ x: p.x + dx, y: p.y + dy })))).fill({ color: 0x000000, alpha: 0.35 });
}
