import { Text, type Graphics } from 'pixi.js';
import { bodyGradient } from '../render/style';
import { SIGNAL_ON } from '../render/wires';

/** Shared drawing for electronic devices (detectors, switches, gates, displays). */

export { SIGNAL_ON };

export function deviceBox(g: Graphics, w: number, h: number, radius = 6, highlight?: number): void {
  g.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, radius).fill({ color: 0x000000, alpha: 0.42 });
  g.roundRect(-w / 2, -h / 2, w, h, radius).fill({ fill: bodyGradient() }).stroke({ width: 1.2, color: highlight ?? 0x5b6476 });
  g.moveTo(-w / 2 + radius, -h / 2 + 1.2).lineTo(w / 2 - radius, -h / 2 + 1.2).stroke({ width: 1, color: 0xffffff, alpha: 0.1 });
}

export function led(g: Graphics, x: number, y: number, on: boolean, color = SIGNAL_ON, r = 2.6): void {
  if (on) g.circle(x, y, r * 2.4).fill({ color, alpha: 0.18 });
  g.circle(x, y, r).fill(on ? color : 0x262c36).stroke({ width: 0.8, color: 0x000000, alpha: 0.6 });
}

/** Lead from the body edge to a port. */
export function lead(g: Graphics, x0: number, y0: number, x1: number, y1: number, on: boolean): void {
  g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 2, color: on ? SIGNAL_ON : 0x59647a, alpha: on ? 0.9 : 0.8 });
}

export function makeLabel(size = 10, color = 0xdfe7f5): Text {
  const t = new Text({ text: '', style: { fontFamily: 'Inter, sans-serif', fontSize: size, fontWeight: '600', fill: color, letterSpacing: 0.3 }, resolution: 4 });
  t.anchor.set(0.5);
  return t;
}
