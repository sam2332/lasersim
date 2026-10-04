import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Vec2 } from '../core/math';
import type { Scene, Signals } from '../core/types';
import { findPort, portNormalWorld, portsOf, portWorld, wireCurve } from '../logic/ports';

export const SIGNAL_ON = 0x3ee8ff;
const SIGNAL_OFF = 0x6c7890;

interface Flow {
  pts: Vec2[];
  lengths: number[];
  total: number;
}

/**
 * Cables between ports (under the elements), port sockets (over them) and
 * glowing signal pulses flowing along live wires (in the bloomed light layer).
 */
export class WireRenderer {
  readonly under = new Container();
  readonly over = new Container();
  readonly glow = new Container();
  private cables = new Graphics();
  private ports = new Graphics();
  private glowLines = new Graphics();
  private pulses: Sprite[] = [];
  private flows: Flow[] = [];
  private phase = 0;

  constructor(private readonly texture: Texture) {
    this.under.addChild(this.cables);
    this.over.addChild(this.ports);
    this.glowLines.blendMode = 'add';
    this.glow.blendMode = 'add';
    this.glow.addChild(this.glowLines);
  }

  draw(scene: Scene, signals: Map<string, Signals>, selectedWireId: string | null, zoom: number): void {
    const px = 1 / zoom;
    const byId = new Map(scene.elements.map((e) => [e.id, e]));
    this.cables.clear();
    this.glowLines.clear();
    this.flows = [];

    for (const w of scene.wires) {
      const a = byId.get(w.from.el);
      const b = byId.get(w.to.el);
      const pa = a && findPort(a, w.from.port);
      const pb = b && findPort(b, w.to.port);
      if (!a || !b || !pa || !pb) continue;
      const pts = wireCurve(portWorld(a, pa), portNormalWorld(a, pa), portWorld(b, pb), portNormalWorld(b, pb));
      const on = !!signals.get(a.id)?.outputs[w.from.port];
      const selected = w.id === selectedWireId;
      const line = (g: Graphics) => {
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      };
      line(this.cables);
      this.cables.stroke({ width: Math.max(6, 4 * px), color: selected ? 0x8fb4ff : 0x07090d, alpha: selected ? 0.9 : 0.85, cap: 'round', join: 'round' });
      line(this.cables);
      this.cables.stroke({ width: Math.max(2.6, 1.6 * px), color: on ? SIGNAL_ON : 0x2f3746, cap: 'round', join: 'round' });
      if (on) {
        line(this.glowLines);
        this.glowLines.stroke({ width: Math.max(7, 5 * px), color: SIGNAL_ON, alpha: 0.18, cap: 'round', join: 'round' });
        const lengths = [0];
        for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        this.flows.push({ pts, lengths, total: lengths[lengths.length - 1] });
      }
    }

    this.ports.clear();
    const r = Math.max(4.5, 4 * px);
    for (const el of scene.elements) {
      const sig = signals.get(el.id);
      for (const p of portsOf(el)) {
        const pos = portWorld(el, p);
        const on = p.dir === 'out' ? !!sig?.outputs[p.id] : !!sig?.inputs[p.id];
        const color = on ? SIGNAL_ON : SIGNAL_OFF;
        if (p.dir === 'out') {
          this.ports.circle(pos.x, pos.y, r).fill(0x07090d).stroke({ width: Math.max(1.5, px), color: 0x000000, alpha: 0.6 });
          this.ports.circle(pos.x, pos.y, r * 0.62).fill(color);
        } else {
          this.ports.circle(pos.x, pos.y, r).fill(0x07090d).stroke({ width: Math.max(2, 1.4 * px), color });
          if (on) this.ports.circle(pos.x, pos.y, r * 0.35).fill(color);
        }
      }
    }
  }

  /** Animate pulses travelling along live wires. */
  tick(dt: number): void {
    this.phase = (this.phase + dt * 140) % 48;
    let used = 0;
    for (const f of this.flows) {
      for (let d = this.phase; d < f.total; d += 48) {
        const s = this.pulses[used] ?? this.makePulse();
        const p = pointAt(f, d);
        s.position.set(p.x, p.y);
        s.visible = true;
        used++;
      }
    }
    for (let i = used; i < this.pulses.length; i++) this.pulses[i].visible = false;
  }

  private makePulse(): Sprite {
    const s = new Sprite(this.texture);
    s.anchor.set(0.5);
    s.tint = SIGNAL_ON;
    s.blendMode = 'add';
    s.scale.set(16 / 256);
    s.alpha = 0.9;
    this.glow.addChild(s);
    this.pulses.push(s);
    return s;
  }
}

function pointAt(f: Flow, d: number): Vec2 {
  let i = 1;
  while (i < f.lengths.length - 1 && f.lengths[i] < d) i++;
  const l0 = f.lengths[i - 1];
  const seg = f.lengths[i] - l0 || 1;
  const t = (d - l0) / seg;
  const a = f.pts[i - 1];
  const b = f.pts[i];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
