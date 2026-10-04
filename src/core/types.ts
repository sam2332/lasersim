import type { Container } from 'pixi.js';
import type { IconNode } from 'lucide';
import type { Vec2 } from './math';
import type { Jones } from '../optics/polarization';
import type { Textures } from '../render/textures';
import type { FxSystem } from '../render/fx';

// ---------------------------------------------------------------------------
// Scene data (plain JSON — this is what gets saved, shared and undone)
// ---------------------------------------------------------------------------

export type Props = Record<string, unknown>;

export interface SceneElement<P extends object = Props> {
  id: string;
  type: string;
  x: number;
  y: number;
  /** Radians. */
  rotation: number;
  locked?: boolean;
  props: P;
}

/** A connection from an output port to an input port. */
export interface Wire {
  id: string;
  from: { el: string; port: string };
  to: { el: string; port: string };
}

export interface Scene {
  version: 1;
  board: { width: number; height: number };
  elements: SceneElement[];
  wires: Wire[];
}

// ---------------------------------------------------------------------------
// Optics
// ---------------------------------------------------------------------------

export interface Ray {
  origin: Vec2;
  dir: Vec2;
  /** Nanometres, 380–700. */
  wavelength: number;
  intensity: number;
  /** Polarization state (Jones vector); null = unpolarized. */
  pol: Jones | null;
  depth: number;
}

export interface OpticsSettings {
  fresnel: boolean;
}

export interface Hit {
  t: number;
  point: Vec2;
  /** World-space unit normal. Points outward when the surface declares `orient`. */
  normal: Vec2;
  element: SceneElement;
  surface: Surface;
}

export interface OutRay {
  dir: Vec2;
  intensity: number;
  wavelength?: number;
  /** undefined = keep the incoming polarization, null = unpolarized. */
  pol?: Jones | null;
}

export interface InteractionContext {
  ray: Ray;
  hit: Hit;
  settings: OpticsSettings;
  /** Deposit light energy on an element (targets use this to ignite). */
  deposit(elementId: string, amount: number): void;
}

/** What happens when light hits a surface. Returns the rays leaving the hit point. */
export interface Material {
  interact(ctx: InteractionContext): OutRay[];
}

interface SurfaceBase {
  material: Material;
  /** Local-space hint: the normal is flipped to face this way (outward for closed shapes). */
  orient?: Vec2;
}

export interface SegmentSurface extends SurfaceBase {
  kind: 'segment';
  a: Vec2;
  b: Vec2;
}

export interface ArcSurface extends SurfaceBase {
  kind: 'arc';
  c: Vec2;
  r: number;
  /** Which points of the full circle belong to this surface. */
  accept?: (p: Vec2) => boolean;
}

/** Surfaces are described in the element's local frame. */
export type Surface = SegmentSurface | ArcSurface;

/** A ray leaving an emitter, in the element's local frame. */
export interface Emission {
  origin: Vec2;
  dir: Vec2;
  wavelength: number;
  intensity: number;
  pol?: Jones | null;
}

/** A gravitational field that bends light continuously (black holes). */
export interface Field {
  strength: number;
  horizon: number;
}

// ---------------------------------------------------------------------------
// Signals (wiring / logic)
// ---------------------------------------------------------------------------

export interface Port {
  id: string;
  dir: 'in' | 'out';
  /** Local-space position (just outside the body). */
  position: Vec2;
  /** Local-space direction wires leave in (defaults to away from the centre). */
  normal?: Vec2;
  label?: string;
}

/** Current digital state around one element. */
export interface Signals {
  inputs: Record<string, boolean>;
  /** Whether an input port has a wire attached. */
  wired: Record<string, boolean>;
  outputs: Record<string, boolean>;
}

export const NO_SIGNALS: Signals = Object.freeze({ inputs: {}, wired: {}, outputs: {} }) as Signals;

export interface LogicContext<P> {
  props: P;
  inputs: Record<string, boolean>;
  wired: Record<string, boolean>;
  /** Light deposited on this element by the latest trace. */
  energy: number;
  /** Per-element runtime memory (not saved). */
  state: Record<string, any>;
  /** Simulation time in seconds. */
  time: number;
  dt: number;
  /** The user clicked/activated a momentary element since the last step. */
  triggered: boolean;
}

// ---------------------------------------------------------------------------
// Inspector parameters
// ---------------------------------------------------------------------------

type Key<P> = keyof P & string;

export type ParamSpec<P> =
  | { kind: 'number'; key: Key<P>; label: string; min: number; max: number; step?: number }
  | { kind: 'boolean'; key: Key<P>; label: string }
  | { kind: 'select'; key: Key<P>; label: string; options: Record<string, string | number> }
  | { kind: 'wavelength'; key: Key<P>; label: string }
  | { kind: 'text'; key: Key<P>; label: string; multiline?: boolean };

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

export interface Handle<P> {
  id: string;
  /** Local-space position. */
  position: Vec2;
  /** Given the pointer in local space, return the prop changes. */
  drag(props: P, local: Vec2): Partial<P>;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface ViewState {
  selected: boolean;
  /** Light energy deposited on this element by the last trace. */
  energy: number;
  signals: Signals;
}

export interface ViewContext {
  textures: Textures;
  fx: FxSystem;
}

export interface ElementView<P extends object> {
  /** Positioned and rotated by the view manager; draw in local space. */
  root: Container;
  update(el: SceneElement<P>, state: ViewState): void;
  tick?(dt: number, el: SceneElement<P>, state: ViewState): void;
  destroy?(): void;
}

// ---------------------------------------------------------------------------
// Element definition — one per file in src/elements
// ---------------------------------------------------------------------------

export type Category = 'source' | 'optic' | 'photonics' | 'io' | 'logic' | 'obstacle' | 'goal' | 'field' | 'note';

export interface Variant<P> {
  label: string;
  icon?: IconNode;
  props: Partial<P>;
}

export interface ElementDef<P extends object = any> {
  type: string;
  label: string;
  icon: IconNode;
  category: Category;
  /** Sort order inside its toolbar category. */
  order?: number;
  description?: string;
  /** Extra toolbar entries that create this element with different props. */
  variants?: Variant<P>[];
  defaults(): P;
  /** Clamp/repair props after edits. */
  normalize?(props: P): P;
  params: ParamSpec<P>[];
  /** Read-only derived values shown in the inspector. */
  info?(props: P): Record<string, string>;
  rotatable?: boolean;
  /** Makes this a puzzle goal; returns whether it is currently satisfied (null = not a goal right now). */
  goalMet?(props: P, energy: number, signals: Signals): boolean | null;

  boundsRadius(props: P): number;
  hitTest(props: P, local: Vec2): boolean;
  handles?(props: P): Handle<P>[];
  /** Double-click / Space behaviour (e.g. power toggle). */
  activate?(props: P): Partial<P>;
  /** Activation sends a momentary runtime pulse instead of changing props (push buttons). */
  trigger?: boolean;
  /** A plain click (without dragging) activates it — switches and buttons. */
  clickActivate?: boolean;

  /** Optics. `signals` lets wired inputs change behaviour (shutters, laser enable…). */
  surfaces?(props: P, signals: Signals): Surface[];
  emit?(props: P, signals: Signals): Emission[];
  field?(props: P): Field;

  /** Wiring ports. */
  ports?(props: P): Port[];
  /** One simulation step: return the new output port values. */
  logic?(ctx: LogicContext<P>): Record<string, boolean>;
  /** Output values before the first step (power-on state). */
  initialOutputs?(props: P): Record<string, boolean>;

  createView(ctx: ViewContext): ElementView<P>;
}
