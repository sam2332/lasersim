import { CircuitBoard } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef, Port } from '../core/types';
import { lead, led, makeLabel, SIGNAL_ON } from '../kit/device';
import { scriptHost } from '../scripting/host';
import { getTemplate } from '../scripting/templates';
import { graphicsView } from '../render/viewkit';

interface McuProps {
  name: string;
  inputs: number;
  outputs: number;
  /** JavaScript program, run sandboxed every simulation tick. */
  code: string;
}

const W = 84;
const PITCH = 20;
const height = (p: McuProps) => Math.max(64, Math.max(p.inputs, p.outputs) * PITCH + 24);
const pinY = (i: number, n: number) => (i - (n - 1) / 2) * PITCH;
const IN_X = -W / 2 - 14;
const OUT_X = W / 2 + 14;

/** Programmable chip: JavaScript decides its outputs from its inputs every tick. */
const mcu: ElementDef<McuProps> = {
  type: 'mcu',
  label: 'Microcontroller',
  icon: CircuitBoard,
  category: 'logic',
  order: 2,
  description: 'A programmable chip. Its JavaScript (run in a sandbox) reads the input pins and sets the output pins every tick. Double-click to edit the code.',
  variants: [
    { label: 'Microcontroller', props: {} },
    { label: 'Morse beacon chip', props: { name: 'MORSE', inputs: 0, outputs: 1, code: getTemplate('morse')!.code } },
  ],
  defaults: () => {
    const t = getTemplate('blank')!;
    return { name: 'CHIP', inputs: t.inputs, outputs: t.outputs, code: t.code };
  },
  normalize: (p) => ({
    ...p,
    name: String(p.name ?? '').slice(0, 12),
    inputs: Math.round(clamp(p.inputs, 0, 8)),
    outputs: Math.round(clamp(p.outputs, 0, 8)),
    code: String(p.code ?? ''),
  }),
  params: [
    { kind: 'action', label: 'Edit code…', event: 'edit-script' },
    { kind: 'text', key: 'name', label: 'Name' },
    { kind: 'number', key: 'inputs', label: 'Input pins', min: 0, max: 8, step: 1 },
    { kind: 'number', key: 'outputs', label: 'Output pins', min: 0, max: 8, step: 1 },
  ],
  openEvent: 'edit-script',

  boundsRadius: (p) => Math.hypot(W / 2 + 14, height(p) / 2),
  hitTest: (p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= height(p) / 2 + 2,
  ports: (p): Port[] => [
    ...Array.from({ length: p.inputs }, (_, i): Port => ({ id: `in${i}`, dir: 'in', position: { x: IN_X, y: pinY(i, p.inputs) }, normal: { x: -1, y: 0 }, label: `in ${i}` })),
    ...Array.from({ length: p.outputs }, (_, i): Port => ({ id: `out${i}`, dir: 'out', position: { x: OUT_X, y: pinY(i, p.outputs) }, normal: { x: 1, y: 0 }, label: `out ${i}` })),
  ],
  logic: ({ id, props, inputs, time, dt }) => {
    const ins = Array.from({ length: props.inputs }, (_, i) => !!inputs[`in${i}`]);
    const outs = scriptHost.step(id, props.code, ins, props.outputs, time, dt);
    return Object.fromEntries(outs.map((v, i) => [`out${i}`, v]));
  },
  disposeRuntime: (id) => scriptHost.dispose(id),

  createView: () => {
    const title = makeLabel(11, 0xe6ebf5);
    const sub = makeLabel(8, 0x7f8aa0);
    return graphicsView<McuProps>(
      (g, p, state, el) => {
        const status = scriptHost.status(el.id);
        const h = height(p);
        // Pins first so the package sits on top.
        for (let i = 0; i < p.inputs; i++) lead(g, IN_X, pinY(i, p.inputs), -W / 2, pinY(i, p.inputs), !!state.signals.inputs[`in${i}`]);
        for (let i = 0; i < p.outputs; i++) lead(g, W / 2, pinY(i, p.outputs), OUT_X, pinY(i, p.outputs), !!state.signals.outputs[`out${i}`]);
        for (let i = 0; i < p.inputs; i++) g.rect(-W / 2 - 6, pinY(i, p.inputs) - 3, 6, 6).fill(0xb9c2d2);
        for (let i = 0; i < p.outputs; i++) g.rect(W / 2, pinY(i, p.outputs) - 3, 6, 6).fill(0xb9c2d2);
        // Package.
        g.roundRect(-W / 2 + 3, -h / 2 + 5, W, h, 5).fill({ color: 0x000000, alpha: 0.45 });
        g.roundRect(-W / 2, -h / 2, W, h, 5)
          .fill(0x15181f)
          .stroke({ width: 1.4, color: status === 'error' ? 0xff5a5a : status === 'running' ? 0x3a5566 : 0x3a4252 });
        g.roundRect(-W / 2 + 4, -h / 2 + 4, W - 8, h - 8, 3).stroke({ width: 1, color: 0x000000, alpha: 0.5 });
        g.arc(0, -h / 2, 7, 0, Math.PI).stroke({ width: 1.4, color: 0x2a303c });
        g.circle(-W / 2 + 10, -h / 2 + 10, 2.2).fill(0x2a303c);
        const color = status === 'error' ? 0xff5a5a : status === 'running' ? SIGNAL_ON : 0xffb347;
        led(g, W / 2 - 10, h / 2 - 10, status !== 'idle', color);
        title.text = p.name || 'CHIP';
        title.position.set(0, -6);
        sub.text = status === 'error' ? 'ERROR' : status === 'loading' ? 'loading…' : `JS · ${p.inputs}→${p.outputs}`;
        sub.position.set(0, 9);
      },
      {
        setup: (root) => root.addChild(title, sub),
        // The chip's status lives in the script host, not in props: re-check it every frame.
        extraKey: (el) => scriptHost.status(el.id),
      },
    );
  },
};

export default mcu;
