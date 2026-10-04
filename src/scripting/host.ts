import mitt from 'mitt';
import type { QuickJSContext, QuickJSRuntime, QuickJSWASMModule } from 'quickjs-emscripten-core';

/**
 * Runs microcontroller scripts inside QuickJS (a separate JavaScript engine
 * compiled to WebAssembly). Scripts cannot reach the page, DOM, storage or
 * network, and every call has a time and memory budget — so a scene shared by
 * someone else can't do anything but flip its own pins.
 */

const MEMORY_LIMIT = 16 * 1024 * 1024;
const STACK_LIMIT = 512 * 1024;
const TICK_BUDGET_MS = 30;
const COMPILE_BUDGET_MS = 200;
const MAX_LOG = 300;

const PRELUDE = `
"use strict";
var state = {};
var __logs = [];
function __fmt(a) { return typeof a === 'string' ? a : (function () { try { return JSON.stringify(a); } catch (e) { return String(a); } })(); }
function print() { __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); if (__logs.length > 100) __logs.shift(); }
var console = { log: print, info: print, warn: print, error: print };
`;

const STEPPER = `
function __step(json) {
  var a = JSON.parse(json);
  var io = { in: a.inputs, out: a.outputs, time: a.time, dt: a.dt, tick: a.tick };
  if (!a.started && typeof onStart === 'function') onStart(io);
  if (typeof onChange === 'function') {
    for (var i = 0; i < a.inputs.length; i++) if (a.inputs[i] !== a.prev[i]) onChange(i, a.inputs[i], io);
  }
  if (typeof onTick === 'function') onTick(io);
  var out = [];
  for (var j = 0; j < a.outputs.length; j++) out.push(!!io.out[j]);
  return JSON.stringify({ out: out, logs: __logs.splice(0) });
}
`;

export type ChipStatus = 'loading' | 'running' | 'error' | 'idle';

interface Chip {
  code: string;
  runtime: QuickJSRuntime;
  ctx: QuickJSContext;
  started: boolean;
  tick: number;
  prev: boolean[];
  outputs: boolean[];
  error: string | null;
}

interface ChipLog {
  lines: string[];
}

class ScriptHost {
  readonly events = mitt<{ log: string; status: string }>();
  private module: QuickJSWASMModule | null = null;
  private loading: Promise<void> | null = null;
  private chips = new Map<string, Chip>();
  private logs = new Map<string, ChipLog>();

  /** Starts loading the engine (lazily, the first time a chip runs). */
  load(): Promise<void> {
    this.loading ??= (async () => {
      const [{ newQuickJSWASMModuleFromVariant }, variant] = await Promise.all([
        import('quickjs-emscripten-core'),
        import('@jitl/quickjs-singlefile-browser-release-sync'),
      ]);
      this.module = await newQuickJSWASMModuleFromVariant(variant.default);
      this.events.emit('status', '*');
    })();
    return this.loading;
  }

  get ready(): boolean {
    return !!this.module;
  }

  status(id: string): ChipStatus {
    if (!this.module) return 'loading';
    const chip = this.chips.get(id);
    if (!chip) return 'idle';
    return chip.error ? 'error' : 'running';
  }

  error(id: string): string | null {
    return this.chips.get(id)?.error ?? null;
  }

  logLines(id: string): string[] {
    return this.logs.get(id)?.lines ?? [];
  }

  clearLog(id: string): void {
    this.logs.delete(id);
    this.events.emit('log', id);
  }

  /** One simulation tick for chip `id`. Never throws; errors halt the chip and are logged. */
  step(id: string, code: string, inputs: boolean[], outputCount: number, time: number, dt: number): boolean[] {
    if (!this.module) {
      void this.load();
      return Array(outputCount).fill(false);
    }
    let chip = this.chips.get(id);
    if (!chip || chip.code !== code) {
      this.dispose(id);
      chip = this.compile(id, code);
    }
    if (chip.error) return Array(outputCount).fill(false);

    while (chip.outputs.length < outputCount) chip.outputs.push(false);
    chip.outputs.length = outputCount;
    // On the first tick there is no previous level, so onChange only reports real changes.
    const prev = chip.started ? chip.prev : inputs;
    const payload = JSON.stringify({ inputs, prev, outputs: chip.outputs, time, dt, tick: chip.tick, started: chip.started });
    const result = this.run(chip, `__step(${JSON.stringify(payload)})`, TICK_BUDGET_MS);
    chip.started = true;
    chip.tick++;
    chip.prev = inputs.slice();
    if (!result.ok) {
      this.fail(id, chip, result.error);
      return Array(outputCount).fill(false);
    }
    try {
      const parsed = JSON.parse(result.value as string) as { out: boolean[]; logs: string[] };
      chip.outputs = parsed.out;
      if (parsed.logs.length) this.append(id, parsed.logs);
    } catch {
      this.fail(id, chip, 'Internal: bad step result');
    }
    return chip.outputs.slice();
  }

  dispose(id: string): void {
    const chip = this.chips.get(id);
    if (!chip) return;
    try {
      chip.ctx.dispose();
      chip.runtime.dispose();
    } catch {
      /* already gone */
    }
    this.chips.delete(id);
    this.events.emit('status', id);
  }

  disposeAll(): void {
    for (const id of [...this.chips.keys()]) this.dispose(id);
  }

  private compile(id: string, code: string): Chip {
    const runtime = this.module!.newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT);
    runtime.setMaxStackSize(STACK_LIMIT);
    const ctx = runtime.newContext();
    const chip: Chip = { code, runtime, ctx, started: false, tick: 0, prev: [], outputs: [], error: null };
    this.chips.set(id, chip);
    for (const [src, name] of [
      [PRELUDE, 'prelude.js'],
      [code, 'chip.js'],
      [STEPPER, 'stepper.js'],
    ] as const) {
      const r = this.run(chip, src, COMPILE_BUDGET_MS, name);
      if (!r.ok) {
        this.fail(id, chip, r.error);
        break;
      }
    }
    if (!chip.error) this.append(id, ['▶ chip started']);
    this.events.emit('status', id);
    return chip;
  }

  private run(chip: Chip, src: string, budgetMs: number, filename = 'tick.js'): { ok: true; value: unknown } | { ok: false; error: string } {
    const deadline = Date.now() + budgetMs;
    chip.runtime.setInterruptHandler(() => Date.now() > deadline);
    const r = chip.ctx.evalCode(src, filename);
    if (r.error) {
      const err = chip.ctx.dump(r.error) as { name?: string; message?: string; stack?: string } | string;
      r.error.dispose();
      if (typeof err === 'string') return { ok: false, error: err };
      const timedOut = /interrupted/i.test(err?.message ?? '');
      const msg = timedOut ? `Script took longer than ${budgetMs} ms (infinite loop?)` : `${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`;
      const where = err?.stack?.split('\n').find((l) => l.includes('chip.js'));
      return { ok: false, error: where ? `${msg}\n${where.trim()}` : msg };
    }
    const value = chip.ctx.dump(r.value);
    r.value.dispose();
    return { ok: true, value };
  }

  private fail(id: string, chip: Chip, error: string): void {
    chip.error = error;
    this.append(id, [`✖ ${error}`, '■ chip halted — fix the code and apply, or reset the simulation']);
    this.events.emit('status', id);
  }

  private append(id: string, lines: string[]): void {
    let log = this.logs.get(id);
    if (!log) this.logs.set(id, (log = { lines: [] }));
    log.lines.push(...lines);
    if (log.lines.length > MAX_LOG) log.lines.splice(0, log.lines.length - MAX_LOG);
    this.events.emit('log', id);
  }
}

export const scriptHost = new ScriptHost();
