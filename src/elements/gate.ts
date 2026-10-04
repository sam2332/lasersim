import type { Graphics } from 'pixi.js';
import { Cpu } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef, Port } from '../core/types';
import { lead, makeLabel, SIGNAL_ON } from '../kit/device';
import { portColumn } from '../logic/ports';
import { bodyGradient } from '../render/style';
import { graphicsView } from '../render/viewkit';

type Op = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR' | 'BUF';

interface GateProps {
  op: Op;
  inputs: number;
  /** Extra propagation delay in simulation ticks (1 = fastest). */
  delay: number;
  /** Output at power-on (lets cross-coupled latches start in a stable state). */
  init: boolean;
}

const OPS: Op[] = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'BUF'];
const INPUT_IDS = ['a', 'b', 'c', 'd'];
const SINGLE = (op: Op) => op === 'NOT' || op === 'BUF';

const count = (p: GateProps) => (SINGLE(p.op) ? 1 : p.inputs);
const height = (p: GateProps) => Math.max(40, count(p) * 16 + 8);
const IN_X = -38;
const OUT_X = 40;

function evaluate(op: Op, v: boolean[]): boolean {
  const ones = v.filter(Boolean).length;
  switch (op) {
    case 'AND':
      return ones === v.length;
    case 'OR':
      return ones > 0;
    case 'XOR':
      return ones % 2 === 1;
    case 'NAND':
      return ones !== v.length;
    case 'NOR':
      return ones === 0;
    case 'XNOR':
      return ones % 2 === 0;
    case 'NOT':
      return !v[0];
    case 'BUF':
      return !!v[0];
  }
}

const inverted = (op: Op) => op === 'NOT' || op === 'NAND' || op === 'NOR' || op === 'XNOR';

/** Standard (ANSI) gate outline; returns the x where the output lead starts. */
function drawSymbol(g: Graphics, op: Op, h: number, stroke: number): number {
  const top = -h / 2;
  const bottom = h / 2;
  const style = { width: 1.8, color: stroke, join: 'round' as const };
  let tip: number;
  if (op === 'AND' || op === 'NAND') {
    g.moveTo(-22, top).lineTo(0, top).arc(0, 0, h / 2, -Math.PI / 2, Math.PI / 2).lineTo(-22, bottom).closePath();
    tip = h / 2;
  } else if (op === 'NOT' || op === 'BUF') {
    g.moveTo(-18, top + 2).lineTo(16, 0).lineTo(-18, bottom - 2).closePath();
    tip = 16;
  } else {
    // OR family: concave back, pointed front.
    g.moveTo(-22, top).quadraticCurveTo(6, top, 24, 0).quadraticCurveTo(6, bottom, -22, bottom).quadraticCurveTo(-12, 0, -22, top).closePath();
    tip = 24;
  }
  g.fill({ fill: bodyGradient() }).stroke(style);
  if (op === 'XOR' || op === 'XNOR') {
    g.moveTo(-29, top).quadraticCurveTo(-19, 0, -29, bottom).stroke(style);
  }
  if (inverted(op)) {
    g.circle(tip + 4.5, 0, 4).fill(0x10141b).stroke(style);
    tip += 9;
  }
  return tip;
}

/** Digital logic gate: AND, OR, NOT, NAND, NOR, XOR, XNOR, buffer. */
const gate: ElementDef<GateProps> = {
  type: 'gate',
  label: 'Logic gate',
  icon: Cpu,
  category: 'logic',
  order: 0,
  description: 'Digital gate. Change the operation and number of inputs in the inspector; delay adds propagation time in ticks.',
  variants: OPS.map((op) => ({ label: `${op} gate`, props: { op } })),
  defaults: () => ({ op: 'AND', inputs: 2, delay: 1, init: false }),
  normalize: (p) => ({ ...p, op: OPS.includes(p.op) ? p.op : 'AND', inputs: Math.round(clamp(p.inputs, 2, 4)), delay: Math.round(clamp(p.delay, 1, 60)) }),
  params: [
    { kind: 'select', key: 'op', label: 'Operation', options: Object.fromEntries(OPS.map((o) => [o, o])) },
    { kind: 'number', key: 'inputs', label: 'Inputs', min: 2, max: 4, step: 1 },
    { kind: 'number', key: 'delay', label: 'Delay (ticks)', min: 1, max: 60, step: 1 },
    { kind: 'boolean', key: 'init', label: 'Power-on output' },
  ],
  initialOutputs: (p) => ({ out: !!p.init }),

  boundsRadius: (p) => Math.max(OUT_X, height(p) / 2) + 2,
  hitTest: (p, l) => l.x >= -30 && l.x <= 32 && Math.abs(l.y) <= height(p) / 2 + 2,
  ports: (p): Port[] => [
    ...portColumn(INPUT_IDS.slice(0, count(p)), 'in', IN_X, Math.min(16, (height(p) - 12) / Math.max(1, count(p) - 1)), ['input A', 'input B', 'input C', 'input D']),
    { id: 'out', dir: 'out', position: { x: OUT_X, y: 0 }, normal: { x: 1, y: 0 }, label: `${p.op} output` },
  ],
  logic: ({ props, inputs, state }) => {
    const value = evaluate(props.op, INPUT_IDS.slice(0, count(props)).map((id) => !!inputs[id]));
    // Delay line: delay 1 = the simulator's inherent one-tick step.
    const q: boolean[] = (state.q ??= Array(props.delay - 1).fill(!!props.init));
    q.push(value);
    while (q.length > props.delay) q.shift();
    return { out: q[0] };
  },

  createView: () => {
    const label = makeLabel(9, 0xaab6cc);
    return graphicsView<GateProps>(
      (g, p, state) => {
        const h = height(p);
        const out = !!state.signals.outputs.out;
        const ports = gate.ports!(p).filter((x) => x.dir === 'in');
        for (const port of ports) lead(g, port.position.x, port.position.y, -22, port.position.y, !!state.signals.inputs[port.id]);
        const tip = drawSymbol(g, p.op, h, out ? SIGNAL_ON : 0x8a95aa);
        lead(g, tip, 0, OUT_X, 0, out);
        label.text = p.op;
        label.position.set(p.op === 'NOT' || p.op === 'BUF' ? -6 : -2, 0);
        label.scale.set(p.op.length > 3 ? 0.85 : 1);
      },
      { setup: (root) => root.addChild(label) },
    );
  },
};

export default gate;
