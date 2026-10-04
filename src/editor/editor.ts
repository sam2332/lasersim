import { Graphics, type FederatedPointerEvent } from 'pixi.js';
import { Frame, rad, snapTo, type Vec2 } from '../core/math';
import { getDef } from '../core/registry';
import { settings } from '../core/settings';
import { makeElement, type Store } from '../core/store';
import type { ElementDef, Handle, Props, SceneElement } from '../core/types';
import type { Stage } from '../render/stage';
import { COLORS } from '../render/style';

type Drag =
  | { kind: 'move'; id: string; offset: Vec2 }
  | { kind: 'rotate'; id: string }
  | { kind: 'handle'; id: string; handle: Handle<Props> };

const POS_STEP = 10;
const ROT_STEP = rad(15);
const ROTATE_GAP = 26;

/** Pointer + keyboard editing: select, move, rotate, drag element handles, shortcuts. */
export class Editor {
  private overlay = new Graphics();
  private drag: Drag | null = null;
  private downAt: Vec2 | null = null;
  private hoverId: string | null = null;
  private shift = false;
  private lastClick = { id: '', time: 0 };

  constructor(
    private readonly stage: Stage,
    private readonly store: Store,
  ) {
    stage.layers.overlay.addChild(this.overlay);
    const vp = stage.viewport;
    vp.on('pointerdown', (e) => this.onDown(e));
    vp.on('globalpointermove', (e) => this.onMove(e));
    vp.on('pointerup', () => this.onUp());
    vp.on('pointerupoutside', () => this.onUp());
    vp.on('zoomed', () => this.redraw());
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('keyup', (e) => (this.shift = e.shiftKey));
    store.events.on('change', () => this.redraw());
    store.events.on('select', () => this.redraw());
  }

  /** Add an element (from the toolbar). Defaults to the centre of the current view. */
  place(type: string, props: Props = {}, at?: Vec2): void {
    const c = at ?? this.stage.viewport.center;
    const p = this.snapPoint(c);
    this.store.add(makeElement(type, p.x, p.y, 0, props));
  }

  screenToWorld(clientX: number, clientY: number): Vec2 {
    const rect = this.stage.app.canvas.getBoundingClientRect();
    return this.stage.viewport.toWorld(clientX - rect.left, clientY - rect.top);
  }

  // ---------------------------------------------------------------- pointer

  private onDown(e: FederatedPointerEvent): void {
    if (e.button !== 0) return;
    this.shift = e.shiftKey;
    const w = this.stage.viewport.toWorld(e.global);
    this.downAt = { x: e.global.x, y: e.global.y };

    const sel = this.store.selected;
    if (sel && !sel.locked) {
      const h = this.handleAt(sel, w);
      if (h) {
        this.beginDrag(h === 'rotate' ? { kind: 'rotate', id: sel.id } : { kind: 'handle', id: sel.id, handle: h });
        return;
      }
    }

    const el = this.elementAt(w);
    if (!el) return;
    this.store.select(el.id);

    const now = performance.now();
    if (this.lastClick.id === el.id && now - this.lastClick.time < 350) this.activate(el);
    this.lastClick = { id: el.id, time: now };

    if (!el.locked) this.beginDrag({ kind: 'move', id: el.id, offset: { x: el.x - w.x, y: el.y - w.y } });
  }

  private onMove(e: FederatedPointerEvent): void {
    this.shift = e.shiftKey;
    const w = this.stage.viewport.toWorld(e.global);
    if (!this.drag) {
      const sel = this.store.selected;
      const overHandle = sel && !sel.locked && this.handleAt(sel, w);
      const hover = this.elementAt(w);
      if ((hover?.id ?? null) !== this.hoverId) {
        this.hoverId = hover?.id ?? null;
        this.redraw();
      }
      this.stage.app.canvas.style.cursor = overHandle ? 'crosshair' : hover ? (hover.locked ? 'pointer' : 'grab') : 'default';
      return;
    }

    const el = this.store.get(this.drag.id);
    if (!el) return;
    const d = this.drag;
    if (d.kind === 'move') {
      const p = this.snapPoint({ x: w.x + d.offset.x, y: w.y + d.offset.y });
      this.store.update(el.id, { x: p.x, y: p.y }, false);
    } else if (d.kind === 'rotate') {
      let a = Math.atan2(w.y - el.y, w.x - el.x);
      if (this.snapping) a = snapTo(a, ROT_STEP);
      this.store.update(el.id, { rotation: a }, false);
    } else {
      const local = new Frame(el.x, el.y, el.rotation).toLocal(w);
      const patch = d.handle.drag(el.props, local) as Props;
      if (this.snapping) for (const k in patch) if (typeof patch[k] === 'number') patch[k] = Math.round(patch[k] as number);
      this.store.updateProps(el.id, patch, false);
    }
  }

  private onUp(): void {
    const wasClick = this.downAt && !this.drag;
    if (this.drag) {
      this.drag = null;
      this.stage.viewport.plugins.resume('drag');
      this.store.commit();
    }
    // Clicking empty space (without panning) clears the selection.
    if (wasClick && this.downAt) {
      const g = this.stage.app.renderer.events.pointer.global;
      if (Math.hypot(g.x - this.downAt.x, g.y - this.downAt.y) < 5 && !this.elementAt(this.stage.viewport.toWorld(g))) {
        this.store.select(null);
      }
    }
    this.downAt = null;
  }

  private beginDrag(d: Drag): void {
    this.drag = d;
    this.stage.viewport.plugins.pause('drag');
    this.stage.app.canvas.style.cursor = 'grabbing';
  }

  private get snapping(): boolean {
    return settings.snap !== this.shift;
  }

  private snapPoint(p: Vec2): Vec2 {
    return this.snapping ? { x: snapTo(p.x, POS_STEP), y: snapTo(p.y, POS_STEP) } : p;
  }

  // ---------------------------------------------------------------- hit tests

  private elementAt(w: Vec2): SceneElement | undefined {
    const els = this.store.scene.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      const def = getDef(el.type);
      if (def?.hitTest(el.props, new Frame(el.x, el.y, el.rotation).toLocal(w))) return el;
    }
    return undefined;
  }

  private handleAt(el: SceneElement, w: Vec2): Handle<Props> | 'rotate' | null {
    const def = getDef(el.type);
    if (!def) return null;
    const frame = new Frame(el.x, el.y, el.rotation);
    const r = 11 / this.stage.viewport.scale.x;
    for (const h of def.handles?.(el.props) ?? []) {
      const p = frame.toWorld(h.position);
      if (Math.hypot(p.x - w.x, p.y - w.y) < r) return h;
    }
    if (def.rotatable !== false) {
      const p = frame.toWorld(this.rotateKnob(def, el));
      if (Math.hypot(p.x - w.x, p.y - w.y) < r * 1.2) return 'rotate';
    }
    return null;
  }

  private rotateKnob(def: ElementDef, el: SceneElement): Vec2 {
    return { x: def.boundsRadius(el.props) + ROTATE_GAP / this.stage.viewport.scale.x, y: 0 };
  }

  // ---------------------------------------------------------------- actions

  private activate(el: SceneElement): void {
    const patch = getDef(el.type)?.activate?.(el.props);
    if (patch) this.store.updateProps(el.id, patch);
  }

  private onKey(e: KeyboardEvent): void {
    this.shift = e.shiftKey;
    const t = e.target as HTMLElement | null;
    if (t && (t.closest('input, textarea, select, [contenteditable]') || t.closest('.tp-rotv'))) return;
    const mod = e.ctrlKey || e.metaKey;
    const sel = this.store.selected;

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.store.redo();
      return;
    }
    if (!sel) return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (!sel.locked) this.store.remove(sel.id);
        break;
      case 'Escape':
        this.store.select(null);
        break;
      case 'q':
      case 'Q':
      case 'e':
      case 'E': {
        if (sel.locked) break;
        const dir = e.key.toLowerCase() === 'q' ? -1 : 1;
        const step = e.shiftKey ? rad(1) : ROT_STEP;
        this.store.update(sel.id, { rotation: snapTo(sel.rotation + dir * step, step) });
        break;
      }
      case ' ':
        e.preventDefault();
        this.activate(sel);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (sel.locked) break;
        e.preventDefault();
        const s = e.shiftKey ? 1 : POS_STEP;
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0;
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
        this.store.update(sel.id, { x: sel.x + dx, y: sel.y + dy });
        break;
      }
      default:
        if (mod && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          this.duplicate(sel);
        }
    }
  }

  duplicate(el: SceneElement): void {
    const copy = makeElement(el.type, el.x + 40, el.y + 40, el.rotation, structuredClone(el.props));
    this.store.add(copy);
  }

  // ---------------------------------------------------------------- overlay

  private redraw(): void {
    const g = this.overlay.clear();
    const s = 1 / this.stage.viewport.scale.x;

    const hover = this.hoverId !== this.store.selectedId ? this.store.get(this.hoverId) : undefined;
    if (hover) {
      const def = getDef(hover.type);
      if (def) g.circle(hover.x, hover.y, def.boundsRadius(hover.props) + 6 * s).stroke({ width: 1.2 * s, color: 0xffffff, alpha: 0.18 });
    }

    const el = this.store.selected;
    const def = el && getDef(el.type);
    if (!el || !def) return;
    const frame = new Frame(el.x, el.y, el.rotation);
    const R = def.boundsRadius(el.props) + 8 * s;
    const color = el.locked ? 0xff9a6a : COLORS.accent;

    // Dashed selection ring.
    const dashes = Math.max(24, Math.round((R / s) / 6));
    for (let i = 0; i < dashes; i++) {
      const a0 = (i / dashes) * Math.PI * 2;
      const a1 = a0 + (Math.PI / dashes) * 1.1;
      g.moveTo(el.x + Math.cos(a0) * R, el.y + Math.sin(a0) * R).arc(el.x, el.y, R, a0, a1);
    }
    g.stroke({ width: 1.5 * s, color, alpha: 0.85 });
    if (el.locked) return;

    if (def.rotatable !== false) {
      const knob = frame.toWorld(this.rotateKnob(def, el));
      const base = frame.toWorld({ x: R, y: 0 });
      g.moveTo(base.x, base.y).lineTo(knob.x, knob.y).stroke({ width: 1.5 * s, color, alpha: 0.7 });
      g.circle(knob.x, knob.y, 7 * s).fill({ color: 0x0b0e14, alpha: 0.9 }).stroke({ width: 2 * s, color });
      g.circle(knob.x, knob.y, 2.5 * s).fill(color);
    }

    for (const h of def.handles?.(el.props) ?? []) {
      const p = frame.toWorld(h.position);
      const r = 5.5 * s;
      g.poly([p.x, p.y - r * 1.3, p.x + r * 1.3, p.y, p.x, p.y + r * 1.3, p.x - r * 1.3, p.y])
        .fill(0xffffff)
        .stroke({ width: 1.6 * s, color });
    }
  }
}
