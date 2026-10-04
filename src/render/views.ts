import type { Container } from 'pixi.js';
import { getDef } from '../core/registry';
import { NO_SIGNALS, type ElementView, type Scene, type SceneElement, type Signals, type ViewContext, type ViewState } from '../core/types';

interface Entry {
  type: string;
  view: ElementView<object>;
  el: SceneElement;
  state: ViewState;
}

/** Keeps one view per scene element, creating/destroying them as the scene changes. */
export class ViewManager {
  private entries = new Map<string, Entry>();

  constructor(
    private readonly layer: Container,
    private readonly ctx: ViewContext,
  ) {}

  sync(scene: Scene, energy: Map<string, number>, selectedId: string | null, signals: Map<string, Signals>): void {
    const seen = new Set<string>();
    scene.elements.forEach((el, index) => {
      seen.add(el.id);
      let entry = this.entries.get(el.id);
      if (entry && entry.type !== el.type) {
        this.destroy(el.id);
        entry = undefined;
      }
      if (!entry) {
        const def = getDef(el.type);
        if (!def) return;
        const view = def.createView(this.ctx);
        this.layer.addChild(view.root);
        entry = { type: el.type, view, el, state: { selected: false, energy: 0, signals: NO_SIGNALS } };
        this.entries.set(el.id, entry);
      }
      entry.el = el;
      entry.state = { selected: el.id === selectedId, energy: energy.get(el.id) ?? 0, signals: signals.get(el.id) ?? NO_SIGNALS };
      const root = entry.view.root;
      root.position.set(el.x, el.y);
      root.rotation = el.rotation;
      root.zIndex = index;
      entry.view.update(el, entry.state);
    });
    for (const id of [...this.entries.keys()]) if (!seen.has(id)) this.destroy(id);
    this.layer.sortableChildren = true;
  }

  tick(dt: number): void {
    for (const e of this.entries.values()) e.view.tick?.(dt, e.el, e.state);
  }

  private destroy(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.view.destroy?.();
    e.view.root.destroy({ children: true });
    this.entries.delete(id);
  }
}
