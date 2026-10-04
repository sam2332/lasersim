import { getDef } from '../core/registry';
import type { Scene, SceneElement, Signals } from '../core/types';
import { portsOf } from './ports';

/**
 * Discrete-time signal simulation. Every step, each element reads the outputs
 * its inputs were wired to *last* step (one tick of propagation delay), plus the
 * light it received in the latest trace, and computes new outputs.
 *
 * Because light → detector → logic → laser → light all goes through the same
 * loop, optical feedback circuits oscillate and latch like real ones.
 */
export class Simulator {
  time = 0;
  ticks = 0;
  private outputs = new Map<string, Record<string, boolean>>();
  private states = new Map<string, Record<string, unknown>>();
  private triggers = new Set<string>();

  trigger(id: string): void {
    this.triggers.add(id);
  }

  reset(): void {
    this.time = 0;
    this.ticks = 0;
    this.outputs.clear();
    this.states.clear();
    this.triggers.clear();
  }

  /** Inputs, wiring and outputs of every element right now. */
  signals(scene: Scene): Map<string, Signals> {
    const map = new Map<string, Signals>();
    for (const el of scene.elements) map.set(el.id, { inputs: {}, wired: {}, outputs: { ...this.outputsOf(el) } });
    for (const w of scene.wires) {
      const target = map.get(w.to.el);
      const source = map.get(w.from.el);
      if (!target || !source) continue;
      target.wired[w.to.port] = true;
      target.inputs[w.to.port] = target.inputs[w.to.port] || !!source.outputs[w.from.port];
    }
    return map;
  }

  private outputsOf(el: SceneElement): Record<string, boolean> {
    return this.outputs.get(el.id) ?? getDef(el.type)?.initialOutputs?.(el.props) ?? {};
  }

  /** Advance one tick. Returns true if any output changed (light/scene needs refreshing). */
  step(scene: Scene, energy: Map<string, number>, dt: number): boolean {
    const signals = this.signals(scene);
    const next = new Map<string, Record<string, boolean>>();
    let changed = false;

    for (const el of scene.elements) {
      const def = getDef(el.type);
      if (!def?.logic) continue;
      let state = this.states.get(el.id);
      if (!state) this.states.set(el.id, (state = {}));
      const sig = signals.get(el.id)!;
      const out = def.logic({
        props: el.props,
        inputs: sig.inputs,
        wired: sig.wired,
        energy: energy.get(el.id) ?? 0,
        state,
        time: this.time,
        dt,
        triggered: this.triggers.has(el.id),
      });
      next.set(el.id, out);
      const prev = this.outputsOf(el);
      for (const p of portsOf(el)) if (p.dir === 'out' && !!prev[p.id] !== !!out[p.id]) changed = true;
    }

    // Forget removed elements.
    for (const id of this.states.keys()) if (!next.has(id)) this.states.delete(id);
    this.outputs = next;
    this.triggers.clear();
    this.time += dt;
    this.ticks++;
    return changed;
  }
}
