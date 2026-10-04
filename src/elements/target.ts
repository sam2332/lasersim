import { Sprite } from 'pixi.js';
import gsap from 'gsap';
import { Target } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { sensor } from '../optics/materials';
import { circleSurface } from '../optics/shapes';
import { COLORS } from '../render/style';
import { graphicsView } from '../render/viewkit';

interface TargetProps {
  radius: number;
  /** Light needed to ignite (1 = one full-power beam). */
  threshold: number;
}

/** Orb that ignites when enough light reaches it. All orbs lit = puzzle solved. */
const target: ElementDef<TargetProps> = {
  type: 'target',
  label: 'Light orb',
  icon: Target,
  category: 'goal',
  description: 'Ignites when hit by light. Light every orb to solve the board.',
  goalMet: (p, energy) => energy >= p.threshold,
  rotatable: false,
  defaults: () => ({ radius: 15, threshold: 0.3 }),
  normalize: (p) => ({ radius: clamp(p.radius, 6, 60), threshold: clamp(p.threshold, 0.05, 5) }),
  params: [
    { kind: 'number', key: 'radius', label: 'Radius', min: 6, max: 60, step: 1 },
    { kind: 'number', key: 'threshold', label: 'Light needed', min: 0.05, max: 5, step: 0.05 },
  ],

  boundsRadius: (p) => p.radius + 6,
  hitTest: (p, l) => Math.hypot(l.x, l.y) <= p.radius + 7,
  surfaces: (p) => [circleSurface(p.radius, sensor)],

  createView: ({ textures, fx }) => {
    let orb: Sprite;
    let glow: Sprite;
    let halo: Sprite;
    let lit = false;
    let time = Math.random() * 10;
    let sparkTimer = 0;
    const level = { v: 0 };

    return graphicsView<TargetProps>(
      (g, p) => {
        const r = p.radius;
        g.circle(2, 4, r + 7).fill({ color: 0x000000, alpha: 0.4 });
        g.circle(0, 0, r + 7).fill(0x0c0f14).stroke({ width: 1.5, color: 0x343c4b });
        g.circle(0, 0, r + 3.5).stroke({ width: 1, color: 0x000000, alpha: 0.8 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          g.moveTo(Math.cos(a) * (r + 4.5), Math.sin(a) * (r + 4.5)).lineTo(Math.cos(a) * (r + 6.5), Math.sin(a) * (r + 6.5));
        }
        g.stroke({ width: 1, color: 0x56607a });
      },
      {
        setup: (root) => {
          halo = new Sprite(textures.glow);
          glow = new Sprite(textures.glow);
          orb = new Sprite(textures.orb);
          for (const s of [halo, glow, orb]) s.anchor.set(0.5);
          halo.blendMode = glow.blendMode = 'add';
          halo.tint = 0xff9a3c;
          glow.tint = COLORS.gold;
          root.addChild(halo, orb, glow);
        },
        update: (el, state) => {
          const nowLit = !!target.goalMet!(el.props, state.energy, state.signals);
          const r = el.props.radius;
          orb.scale.set((r * 2) / 256);
          if (nowLit !== lit) {
            lit = nowLit;
            gsap.to(level, { v: lit ? 1 : 0, duration: lit ? 0.35 : 0.6, ease: 'power2.out' });
            if (lit) {
              gsap.fromTo(orb.scale, { x: (r * 3.2) / 256, y: (r * 3.2) / 256 }, { x: (r * 2) / 256, y: (r * 2) / 256, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
              fx.burst(el.x, el.y, { count: 46, speed: 260, life: 0.9, size: 12, color: 0xffd27a });
              fx.burst(el.x, el.y, { count: 14, speed: 120, life: 1.3, size: 22, color: 0xff8a3a });
            }
          }
        },
        tick: (dt, el) => {
          time += dt;
          const r = el.props.radius;
          const v = level.v;
          const pulse = 1 + 0.08 * Math.sin(time * 5) + 0.04 * Math.sin(time * 13);
          orb.tint = lerpColor(0x4a3d2a, 0xfff1c8, v);
          glow.alpha = v * 0.95;
          glow.scale.set(((r * 5.5) / 256) * pulse);
          halo.alpha = v * 0.5;
          halo.scale.set(((r * 12) / 256) * (2 - pulse));
          if (v > 0.9) {
            sparkTimer -= dt;
            if (sparkTimer <= 0) {
              sparkTimer = 0.05 + Math.random() * 0.08;
              const a = Math.random() * Math.PI * 2;
              fx.burst(el.x + Math.cos(a) * r, el.y + Math.sin(a) * r, { count: 1, angle: a, spread: 0.6, speed: 110, life: 0.55, size: 9, color: 0xffd27a });
            }
          }
        },
      },
    );
  },
};

function lerpColor(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const mix = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

export default target;
