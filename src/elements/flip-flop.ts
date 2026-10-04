import type { Text } from 'pixi.js';
import { MemoryStick } from 'lucide';
import type { ElementDef, Port } from '../core/types';
import { deviceBox, lead, makeLabel, SIGNAL_ON } from '../kit/device';
import { graphicsView } from '../render/viewkit';

type Mode = 'D' | 'T' | 'SR' | 'JK';

interface FlipFlopProps {
  mode: Mode;
}

const W = 56;
const H = 70;
const IN_X = -W / 2 - 12;
const OUT_X = W / 2 + 12;

const INPUTS: Record<Mode, string[]> = {
  D: ['d', 'clk'],
  T: ['clk'],
  SR: ['s', 'r'],
  JK: ['j', 'clk', 'k'],
};

const NAMES: Record<string, string> = { d: 'D', clk: '▷', s: 'S', r: 'R', j: 'J', k: 'K' };
const PIN_LABELS: Record<string, string> = { d: 'D (data)', clk: 'clock (rising edge)', s: 'S (set)', r: 'R (reset)', j: 'J (set)', k: 'K (reset)' };

const inputY = (ids: string[], i: number) => (i - (ids.length - 1) / 2) * 20;

/** 1-bit memory: D, T (toggle), SR latch and JK flip-flops. Clocked types trigger on the rising edge. */
const flipFlop: ElementDef<FlipFlopProps> = {
  type: 'flip-flop',
  label: 'Flip-flop',
  icon: MemoryStick,
  category: 'logic',
  order: 1,
  description: 'One bit of memory. D stores D on a clock edge, T toggles on each edge, SR sets/resets, JK does all three.',
  variants: [
    { label: 'D flip-flop', props: { mode: 'D' } },
    { label: 'T flip-flop', props: { mode: 'T' } },
    { label: 'SR latch', props: { mode: 'SR' } },
    { label: 'JK flip-flop', props: { mode: 'JK' } },
  ],
  defaults: () => ({ mode: 'D' }),
  initialOutputs: () => ({ q: false, nq: true }),
  params: [{ kind: 'select', key: 'mode', label: 'Type', options: { 'D flip-flop': 'D', 'T flip-flop': 'T', 'SR latch': 'SR', 'JK flip-flop': 'JK' } }],

  boundsRadius: () => Math.hypot(W, H) / 2 + 4,
  hitTest: (_p, l) => Math.abs(l.x) <= W / 2 + 2 && Math.abs(l.y) <= H / 2 + 2,
  ports: (p): Port[] => [
    ...INPUTS[p.mode].map((id, i): Port => ({ id, dir: 'in', position: { x: IN_X, y: inputY(INPUTS[p.mode], i) }, normal: { x: -1, y: 0 }, label: PIN_LABELS[id] })),
    { id: 'q', dir: 'out', position: { x: OUT_X, y: -14 }, normal: { x: 1, y: 0 }, label: 'Q (stored bit)' },
    { id: 'nq', dir: 'out', position: { x: OUT_X, y: 14 }, normal: { x: 1, y: 0 }, label: 'Q̄ (inverted)' },
  ],
  logic: ({ props, inputs, state }) => {
    let q: boolean = state.q ?? false;
    const clk = !!inputs.clk;
    // No edge on the very first step: there is no previous level yet.
    const rising = clk && state.clk === false;
    state.clk = clk;
    switch (props.mode) {
      case 'D':
        if (rising) q = !!inputs.d;
        break;
      case 'T':
        if (rising) q = !q;
        break;
      case 'SR':
        if (inputs.s && !inputs.r) q = true;
        else if (inputs.r && !inputs.s) q = false;
        break;
      case 'JK':
        if (rising) {
          if (inputs.j && inputs.k) q = !q;
          else if (inputs.j) q = true;
          else if (inputs.k) q = false;
        }
        break;
    }
    state.q = q;
    return { q, nq: !q };
  },

  createView: () => {
    const title = makeLabel(10, 0xaab6cc);
    const pins: Text[] = [];
    return graphicsView<FlipFlopProps>(
      (g, p, state) => {
        const q = !!state.signals.outputs.q;
        deviceBox(g, W, H, 5, q ? SIGNAL_ON : undefined);
        const ids = INPUTS[p.mode];
        ids.forEach((id, i) => lead(g, IN_X, inputY(ids, i), -W / 2, inputY(ids, i), !!state.signals.inputs[id]));
        lead(g, W / 2, -14, OUT_X, -14, q);
        lead(g, W / 2, 14, OUT_X, 14, !!state.signals.outputs.nq);
        title.text = p.mode === 'SR' ? 'SR' : `${p.mode}-FF`;
        const labels = [...ids.map((id, i) => ({ t: NAMES[id], x: -W / 2 + 9, y: inputY(ids, i) })), { t: 'Q', x: W / 2 - 9, y: -14 }, { t: 'Q̄', x: W / 2 - 9, y: 14 }];
        labels.forEach((l, i) => {
          const pin = pins[i];
          if (!pin) return;
          pin.visible = true;
          pin.text = l.t;
          pin.position.set(l.x, l.y);
        });
        for (let i = labels.length; i < pins.length; i++) pins[i].visible = false;
      },
      {
        setup: (root) => {
          title.position.set(0, -H / 2 + 10);
          root.addChild(title);
          for (let i = 0; i < 5; i++) {
            const t = makeLabel(9, 0x8a95aa);
            pins.push(t);
            root.addChild(t);
          }
        },
      },
    );
  },
};

export default flipFlop;
