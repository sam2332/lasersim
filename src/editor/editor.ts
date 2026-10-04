import mitt from 'mitt';
import { Graphics, type FederatedPointerEvent } from 'pixi.js';
import { Frame, rad, snapTo, type Vec2 } from '../core/math';
import { bus } from '../core/bus';
import { getDef } from '../core/registry';
import { settings } from '../core/settings';
import { makeElement, type Store } from '../core/store';
import type { ElementDef, Handle, Port, Props, SceneElement, Wire } from '../core/types';
import { findPort, portNormalWorld, portsOf, portWorld, wireCurve } from '../logic/ports';
import type { Stage } from '../render/stage';
import { COLORS } from '../render/style';
import { SIGNAL_ON } from '../render/wires';

export interface PortRef {
  el: SceneElement;
  port: Port;
}

type Drag =
  | { kind: 'move'; id: string; offset: Vec2; moved: boolean }
  | { kind: 'rotate'; id: string }
  | { kind: 'handle'; id: string; handle: Handle<Props> }
  | { kind: 'wire'; from: PortRef; pointer: Vec2 };

/** Lets a tool (e.g. a particle brush) claim pointer gestures before normal editing. */
export interface PointerInterceptor {
  /** Return true to take over this gesture. */
  down(world: Vec2, e: FederatedPointerEvent): boolean;
  move(world: Vec2, e: FederatedPointerEvent): void;
  up(): void;
  /** Pointer moved with no gesture in progress (for brush cursors). */
  hover?(world: Vec2): void;
}

export interface EditorRuntime {
  /** Send a momentary pulse to an element (push buttons). */
  trigger(id: string): void;
}

const POS_STEP = 10;
const ROT_STEP = rad(15);
const ROTATE_GAP = 26;

/**
 * Pointer + keyboard editing: select, move, rotate, reshape via handles,
 * draw wires between ports, and shortcuts.
 */
export class Editor {
  /** Hover feedback for UI add-ons (e.g. port tooltips). */
  readonly events = mitt<{ 'port-hover': PortRef | null }>();
  private overlay = new Graphics();
  private drag: Drag | null = null;
  private downAt: Vec2 | null = null;
  private hoverId: string | null = null;
  private hoverPort: PortRef | null = null;
  private shift = false;
  private lastClick = { id: '', time: 0 };
  private interceptors: PointerInterceptor[] = [];
  private intercepting: PointerInterceptor | null = null;

  constructor(
    private readonly stage: Stage,
    private readonly store: Store,
    private readonly runtime: EditorRuntime,
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

  addInterceptor(i: PointerInterceptor): void {
    this.interceptors.push(i);
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

    for (const i of this.interceptors) {
      if (i.down(w, e)) {
        this.intercepting = i;
        this.stage.viewport.plugins.pause('drag');
        return;
      }
    }

    const sel = this.store.selected;
    if (sel && !sel.locked) {
      const h = this.handleAt(sel, w);
      if (h) {
        this.beginDrag(h === 'rotate' ? { kind: 'rotate', id: sel.id } : { kind: 'handle', id: sel.id, handle: h });
        return;
      }
    }

    const port = this.portAt(w);
    if (port) {
      this.beginWire(port, w);
      return;
    }

    const el = this.elementAt(w);
    if (el) {
      this.store.select(el.id);
      const now = performance.now();
      const def = getDef(el.type);
      if (!def?.clickActivate && this.lastClick.id === el.id && now - this.lastClick.time < 350) this.activate(el);
      this.lastClick = { id: el.id, time: now };
      if (!el.locked || def?.clickActivate) {
        this.beginDrag({ kind: 'move', id: el.id, offset: { x: el.x - w.x, y: el.y - w.y }, moved: false });
      }
      return;
    }

    const wire = this.wireAt(w);
    if (wire) this.store.selectWire(wire.id);
  }

  private onMove(e: FederatedPointerEvent): void {
    this.shift = e.shiftKey;
    const w = this.stage.viewport.toWorld(e.global);
    if (this.intercepting) {
      this.intercepting.move(w, e);
      return;
    }
    for (const i of this.interceptors) i.hover?.(w);
    if (!this.drag) {
      const sel = this.store.selected;
      const overHandle = sel && !sel.locked && this.handleAt(sel, w);
      const port = this.portAt(w);
      const hover = port ? undefined : this.elementAt(w);
      if ((hover?.id ?? null) !== this.hoverId || port?.port !== this.hoverPort?.port) {
        if (port?.port !== this.hoverPort?.port) this.events.emit('port-hover', port);
        this.hoverId = hover?.id ?? null;
        this.hoverPort = port;
        this.redraw();
      }
      const def = hover && getDef(hover.type);
      this.stage.app.canvas.style.cursor =
        overHandle || port ? 'crosshair' : hover ? (def?.clickActivate ? 'pointer' : hover.locked ? 'pointer' : 'grab') : this.wireAt(w) ? 'pointer' : 'default';
      return;
    }

    const d = this.drag;
    if (d.kind === 'wire') {
      d.pointer = w;
      const port = this.portAt(w);
      if (port?.port !== this.hoverPort?.port) this.events.emit('port-hover', port);
      this.hoverPort = port;
      this.redraw();
      return;
    }
    const el = this.store.get(d.id);
    if (!el) return;
    if (d.kind === 'move') {
      if (this.downAt && Math.hypot(e.global.x - this.downAt.x, e.global.y - this.downAt.y) < 4 && !d.moved) return;
      if (el.locked) return;
      d.moved = true;
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
    if (this.intercepting) {
      this.intercepting.up();
      this.intercepting = null;
      this.stage.viewport.plugins.resume('drag');
      this.downAt = null;
      return;
    }
    const d = this.drag;
    const wasClick = this.downAt && !d;
    if (d) {
      this.drag = null;
      this.stage.viewport.plugins.resume('drag');
      if (d.kind === 'wire') this.finishWire(d.from, d.pointer);
      if (d.kind === 'move' && !d.moved) {
        const el = this.store.get(d.id);
        if (el && getDef(el.type)?.clickActivate) this.activate(el);
      }
      this.store.commit();
      this.redraw();
    }
    // Clicking empty space (without panning) clears the selection.
    if (wasClick && this.downAt) {
      const g = this.stage.app.renderer.events.pointer.global;
      const w = this.stage.viewport.toWorld(g);
      if (Math.hypot(g.x - this.downAt.x, g.y - this.downAt.y) < 5 && !this.elementAt(w) && !this.wireAt(w)) {
        this.store.select(null);
      }
    }
    this.downAt = null;
  }

  private beginDrag(d: Drag): void {
    this.drag = d;
    this.stage.viewport.plugins.pause('drag');
    this.stage.app.canvas.style.cursor = d.kind === 'wire' ? 'crosshair' : 'grabbing';
  }

  // ---------------------------------------------------------------- wiring

  private beginWire(port: PortRef, w: Vec2): void {
    // Grabbing a connected input picks up its wire so it can be moved or dropped off.
    if (port.port.dir === 'in') {
      const existing = this.store.scene.wires.find((x) => x.to.el === port.el.id && x.to.port === port.port.id);
      const src = existing && this.store.get(existing.from.el);
      const srcPort = src && findPort(src, existing.from.port);
      if (existing && src && srcPort) {
        this.store.removeWire(existing.id, false);
        this.beginDrag({ kind: 'wire', from: { el: src, port: srcPort }, pointer: w });
        return;
      }
    }
    this.beginDrag({ kind: 'wire', from: port, pointer: w });
  }

  private finishWire(from: PortRef, pointer: Vec2): void {
    const to = this.portAt(pointer);
    if (!to || !this.compatible(from, to)) return;
    const [out, inp] = from.port.dir === 'out' ? [from, to] : [to, from];
    this.store.addWire({ el: out.el.id, port: out.port.id }, { el: inp.el.id, port: inp.port.id });
  }

  private compatible(a: PortRef, b: PortRef): boolean {
    return a.el.id !== b.el.id && a.port.dir !== b.port.dir;
  }

  // ---------------------------------------------------------------- hit tests

  private get snapping(): boolean {
    return settings.snap !== this.shift;
  }

  private snapPoint(p: Vec2): Vec2 {
    return this.snapping ? { x: snapTo(p.x, POS_STEP), y: snapTo(p.y, POS_STEP) } : p;
  }

  private elementAt(w: Vec2): SceneElement | undefined {
    const els = this.store.scene.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      const def = getDef(el.type);
      if (def?.hitTest(el.props, new Frame(el.x, el.y, el.rotation).toLocal(w))) return el;
    }
    return undefined;
  }

  private portAt(w: Vec2): PortRef | null {
    const r = Math.max(9, 9 / this.stage.viewport.scale.x);
    let best: PortRef | null = null;
    let bestD = r;
    for (const el of this.store.scene.elements) {
      for (const port of portsOf(el)) {
        const p = portWorld(el, port);
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d < bestD) {
          bestD = d;
          best = { el, port };
        }
      }
    }
    return best;
  }

  private wireAt(w: Vec2): Wire | undefined {
    const tol = Math.max(5, 6 / this.stage.viewport.scale.x);
    for (const wire of this.store.scene.wires) {
      const pts = this.wirePoints(wire);
      if (!pts) continue;
      for (let i = 1; i < pts.length; i++) if (distToSegment(w, pts[i - 1], pts[i]) < tol) return wire;
    }
    return undefined;
  }

  private wirePoints(wire: Wire): Vec2[] | null {
    const a = this.store.get(wire.from.el);
    const b = this.store.get(wire.to.el);
    const pa = a && findPort(a, wire.from.port);
    const pb = b && findPort(b, wire.to.port);
    if (!a || !b || !pa || !pb) return null;
    return wireCurve(portWorld(a, pa), portNormalWorld(a, pa), portWorld(b, pb), portNormalWorld(b, pb), 20);
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

  activate(el: SceneElement): void {
    const def = getDef(el.type);
    if (!def) return;
    if (def.openEvent) {
      bus.emit(def.openEvent, el.id);
      return;
    }
    if (def.trigger) {
      this.runtime.trigger(el.id);
      return;
    }
    const patch = def.activate?.(el.props);
    if (patch) this.store.updateProps(el.id, patch);
  }

  private onKey(e: KeyboardEvent): void {
    this.shift = e.shiftKey;
    const t = e.target as HTMLElement | null;
    if (t && (t.closest('input, textarea, select, [contenteditable]') || t.closest('.tp-rotv'))) return;
    const mod = e.ctrlKey || e.metaKey;

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

    const wire = this.store.selectedWire;
    if (wire) {
      if (e.key === 'Delete' || e.key === 'Backspace') this.store.removeWire(wire.id);
      if (e.key === 'Escape') this.store.selectWire(null);
      return;
    }

    const sel = this.store.selected;
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

    // Wire being drawn.
    const d = this.drag;
    if (d?.kind === 'wire') {
      const a = portWorld(d.from.el, d.from.port);
      const na = portNormalWorld(d.from.el, d.from.port);
      const target = this.hoverPort && this.compatible(d.from, this.hoverPort) ? this.hoverPort : null;
      const b = target ? portWorld(target.el, target.port) : d.pointer;
      const nb = target ? portNormalWorld(target.el, target.port) : { x: -na.x, y: -na.y };
      const pts = wireCurve(a, na, b, nb);
      g.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
      g.stroke({ width: 3 * s, color: target ? SIGNAL_ON : 0xffffff, alpha: 0.85, cap: 'round' });
      if (target) g.circle(b.x, b.y, 10 * s).stroke({ width: 2 * s, color: SIGNAL_ON });
    }

    // Port hover ring + label.
    if (this.hoverPort && d?.kind !== 'wire') {
      const p = portWorld(this.hoverPort.el, this.hoverPort.port);
      g.circle(p.x, p.y, 10 * s).stroke({ width: 2 * s, color: 0xffffff, alpha: 0.8 });
    }

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
    const dashes = Math.max(24, Math.round(R / s / 6));
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

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}
