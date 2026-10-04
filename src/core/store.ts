import mitt from 'mitt';
import { getDef } from './registry';
import type { Props, Scene, SceneElement, Wire } from './types';

type StoreEvents = {
  /** Scene contents changed (any edit, undo, load). */
  change: void;
  /** Selection changed. */
  select: string | null;
  /** A committed edit landed in history (good moment to autosave). */
  commit: void;
};

const HISTORY_LIMIT = 200;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Build an element of `type`, filling in defaults and normalizing props. */
export function makeElement(
  type: string,
  x: number,
  y: number,
  rotation = 0,
  props: Props = {},
  extra: Partial<SceneElement> = {},
): SceneElement {
  const def = getDef(type);
  if (!def) throw new Error(`Unknown element type "${type}"`);
  let merged = { ...def.defaults(), ...props };
  if (def.normalize) merged = def.normalize(merged);
  return { id: newId(), type, x, y, rotation, props: merged, ...extra };
}

/** Drop unknown element types and fill in any props missing from older saves. */
export function sanitizeScene(raw: unknown): Scene | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<Scene>;
  if (!Array.isArray(s.elements)) return null;
  const elements: SceneElement[] = [];
  for (const e of s.elements) {
    const def = e && getDef(e.type);
    if (!def) continue;
    let props = { ...def.defaults(), ...(e.props ?? {}) };
    if (def.normalize) props = def.normalize(props);
    elements.push({
      id: typeof e.id === 'string' ? e.id : newId(),
      type: e.type,
      x: Number(e.x) || 0,
      y: Number(e.y) || 0,
      rotation: Number(e.rotation) || 0,
      locked: !!e.locked,
      props,
    });
  }
  const board = s.board && s.board.width > 0 && s.board.height > 0 ? s.board : { width: 1800, height: 1100 };
  const ids = new Set(elements.map((e) => e.id));
  const wires: Wire[] = (Array.isArray(s.wires) ? s.wires : []).filter(
    (w) => w && ids.has(w.from?.el) && ids.has(w.to?.el) && typeof w.from.port === 'string' && typeof w.to.port === 'string',
  );
  for (const w of wires) if (typeof w.id !== 'string') w.id = newId();
  return { version: 1, board, elements, wires };
}

export class Store {
  readonly events = mitt<StoreEvents>();
  scene: Scene;
  selectedId: string | null = null;
  selectedWireId: string | null = null;

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private committed: string;

  constructor(scene: Scene) {
    this.scene = scene;
    this.committed = JSON.stringify(scene);
  }

  get(id: string | null): SceneElement | undefined {
    return id ? this.scene.elements.find((e) => e.id === id) : undefined;
  }

  get selected(): SceneElement | undefined {
    return this.get(this.selectedId);
  }

  select(id: string | null): void {
    if (id === this.selectedId && !this.selectedWireId) return;
    this.selectedId = id;
    this.selectedWireId = null;
    this.events.emit('select', id);
  }

  selectWire(id: string | null): void {
    if (id === this.selectedWireId && !this.selectedId) return;
    this.selectedWireId = id;
    this.selectedId = null;
    this.events.emit('select', null);
  }

  get selectedWire(): Wire | undefined {
    return this.scene.wires.find((w) => w.id === this.selectedWireId);
  }

  /** Connect an output port to an input port (an input takes only one wire). */
  addWire(from: Wire['from'], to: Wire['to']): void {
    this.scene.wires = this.scene.wires.filter((w) => !(w.to.el === to.el && w.to.port === to.port));
    this.scene.wires.push({ id: newId(), from, to });
    this.changed();
    this.commit();
  }

  removeWire(id: string, commit = true): void {
    const before = this.scene.wires.length;
    this.scene.wires = this.scene.wires.filter((w) => w.id !== id);
    if (this.scene.wires.length === before) return;
    if (this.selectedWireId === id) this.selectWire(null);
    this.changed();
    if (commit) this.commit();
  }

  add(el: SceneElement, select = true): void {
    this.scene.elements.push(el);
    this.changed();
    this.commit();
    if (select) this.select(el.id);
  }

  remove(id: string): void {
    const i = this.scene.elements.findIndex((e) => e.id === id);
    if (i < 0) return;
    this.scene.elements.splice(i, 1);
    this.scene.wires = this.scene.wires.filter((w) => w.from.el !== id && w.to.el !== id);
    if (this.selectedId === id) this.select(null);
    this.changed();
    this.commit();
  }

  /** Patch transform/flags. Pass commit=false for live drags, then call commit() at the end. */
  update(id: string, patch: Partial<Omit<SceneElement, 'id' | 'type' | 'props'>>, commit = true): void {
    const el = this.get(id);
    if (!el) return;
    Object.assign(el, patch);
    this.changed();
    if (commit) this.commit();
  }

  updateProps(id: string, patch: Props, commit = true): void {
    const el = this.get(id);
    if (!el) return;
    const def = getDef(el.type);
    let props = { ...el.props, ...patch };
    if (def?.normalize) props = def.normalize(props);
    el.props = props;
    this.changed();
    if (commit) this.commit();
  }

  load(scene: Scene): void {
    this.commit();
    this.scene = scene;
    this.select(null);
    this.changed();
    this.commit();
  }

  /** Record the current scene as a history step (no-op if nothing changed). */
  commit(): void {
    const now = JSON.stringify(this.scene);
    if (now === this.committed) return;
    this.undoStack.push(this.committed);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.committed = now;
    this.events.emit('commit');
  }

  undo(): void {
    this.commit();
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.committed);
    this.restore(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.committed);
    this.restore(next);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private restore(json: string): void {
    this.committed = json;
    this.scene = JSON.parse(json);
    if (!this.get(this.selectedId)) this.select(null);
    if (this.selectedWireId && !this.selectedWire) this.selectWire(null);
    this.changed();
    this.events.emit('commit');
  }

  private changed(): void {
    this.events.emit('change');
  }
}
