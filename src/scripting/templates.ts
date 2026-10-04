/** Starter programs for the microcontroller. `inputs`/`outputs` are the pin counts they expect. */
export interface ScriptTemplate {
  id: string;
  name: string;
  inputs: number;
  outputs: number;
  code: string;
}

export const API_HELP = `// io.in[i]   — input pins (true/false), read-only
// io.out[i]  — output pins; they keep their value until you change them
// io.time    — simulation time in seconds, io.dt — seconds per tick
// io.tick    — ticks since this chip started
// state      — your own object that survives between ticks
// print(...) — write to the console below
//
// function onStart(io)              — once, on the first tick
// function onChange(pin, value, io) — whenever an input pin changes
// function onTick(io)               — every simulation tick
`;

export const TEMPLATES: ScriptTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    inputs: 2,
    outputs: 2,
    code: `${API_HELP}
function onTick(io) {
  // Copy input 0 to output 0.
  io.out[0] = io.in[0];
}
`,
  },
  {
    id: 'blink',
    name: 'Blink',
    inputs: 1,
    outputs: 1,
    code: `// Blink output 0. Input 0 (if wired) pauses the blinking.
const PERIOD = 0.6; // seconds

function onTick(io) {
  if (io.in[0]) return;
  io.out[0] = (io.time % PERIOD) < PERIOD / 2;
}
`,
  },
  {
    id: 'gates',
    name: 'Logic gates',
    inputs: 2,
    outputs: 4,
    code: `// Four gates in one chip.
function onTick(io) {
  const [a, b] = io.in;
  io.out[0] = a && b;   // AND
  io.out[1] = a || b;   // OR
  io.out[2] = a !== b;  // XOR
  io.out[3] = !(a || b); // NOR
}
`,
  },
  {
    id: 'counter',
    name: 'Edge counter',
    inputs: 2,
    outputs: 4,
    code: `// Counts rising edges on input 0 and outputs the count in binary (4 bits).
// Input 1 resets the count.
state.count = 0;

function onChange(pin, value, io) {
  if (pin === 0 && value) {
    state.count = (state.count + 1) % 16;
    print('count =', state.count);
  }
  if (pin === 1 && value) state.count = 0;
}

function onTick(io) {
  for (let bit = 0; bit < 4; bit++) io.out[bit] = ((state.count >> bit) & 1) === 1;
}
`,
  },
  {
    id: 'scanner',
    name: 'Light scanner',
    inputs: 1,
    outputs: 4,
    code: `// Sweeps a single lit output back and forth across 4 pins ("Knight Rider").
// Input 0 doubles the speed.
state.pos = 0;
state.dir = 1;

function onTick(io) {
  const every = io.in[0] ? 2 : 4; // ticks per step
  if (io.tick % every !== 0) return;
  io.out.fill(false);
  io.out[state.pos] = true;
  if (state.pos + state.dir < 0 || state.pos + state.dir > 3) state.dir = -state.dir;
  state.pos += state.dir;
}
`,
  },
  {
    id: 'morse',
    name: 'Morse beacon',
    inputs: 0,
    outputs: 1,
    code: `// Flashes a message in Morse code on output 0 (wire it to a laser).
const MESSAGE = 'SOS LASER';
const UNIT = 3; // ticks per Morse unit
const CODE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..',
  J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...',
  T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };

// Build the on/off pattern once: dot = 1 unit on, dash = 3, gaps of 1 / 3 / 7 units.
state.pattern = [];
for (const word of MESSAGE.split(' ')) {
  for (const ch of word) {
    for (const sym of CODE[ch]) {
      const len = sym === '.' ? 1 : 3;
      for (let i = 0; i < len * UNIT; i++) state.pattern.push(true);
      for (let i = 0; i < UNIT; i++) state.pattern.push(false);
    }
    for (let i = 0; i < 2 * UNIT; i++) state.pattern.push(false);
  }
  for (let i = 0; i < 4 * UNIT; i++) state.pattern.push(false);
}
print('pattern is', state.pattern.length, 'ticks long');

function onTick(io) {
  io.out[0] = state.pattern[io.tick % state.pattern.length];
}
`,
  },
  {
    id: 'tx',
    name: 'Optical transmitter',
    inputs: 0,
    outputs: 5,
    code: `// Sends the numbers 0..15 over a light beam, one after another.
// Output 0 drives a laser. Outputs 1-4 show the number being sent.
// Frame: start bit (ON), 4 data bits (least significant first), 2 idle bits (OFF).
const BIT = 4; // ticks per bit — the receiver must use the same value

state.value = 0;
state.frame = [];
state.t = 0;

function onTick(io) {
  if (state.frame.length === 0) {
    const v = state.value;
    state.frame = [1, v & 1, (v >> 1) & 1, (v >> 2) & 1, (v >> 3) & 1, 0, 0];
    for (let b = 0; b < 4; b++) io.out[1 + b] = ((v >> b) & 1) === 1;
    print('sending', v);
    state.value = (v + 1) % 16;
  }
  io.out[0] = state.frame[0] === 1;
  if (++state.t >= BIT) {
    state.t = 0;
    state.frame.shift();
  }
}
`,
  },
  {
    id: 'rx',
    name: 'Optical receiver',
    inputs: 1,
    outputs: 4,
    code: `// Decodes frames from the optical transmitter (input 0 = photodetector).
// Outputs 0-3 hold the last number received.
const BIT = 4; // ticks per bit — must match the transmitter

state.mode = 'idle';
state.wait = 0;
state.bits = [];

function onTick(io) {
  const light = io.in[0];
  if (state.mode === 'idle') {
    if (light) {
      // Start bit seen: the middle of data bit 0 is 1.5 bits from now.
      state.mode = 'data';
      state.bits = [];
      state.wait = BIT + Math.floor(BIT / 2);
    }
    return;
  }
  if (--state.wait > 0) return;
  if (state.mode === 'data') {
    state.bits.push(light ? 1 : 0);
    if (state.bits.length < 4) {
      state.wait = BIT;
      return;
    }
    const v = state.bits[0] | (state.bits[1] << 1) | (state.bits[2] << 2) | (state.bits[3] << 3);
    for (let b = 0; b < 4; b++) io.out[b] = ((v >> b) & 1) === 1;
    print('received', v);
    state.mode = 'stop';
    state.wait = BIT; // let the idle bits pass
  } else {
    state.mode = 'idle';
  }
}
`,
  },
];

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);
