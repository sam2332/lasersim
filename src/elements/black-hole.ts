import { Container, Sprite } from 'pixi.js';
import { Orbit } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef } from '../core/types';
import { settings } from '../core/settings';
import { graphicsView } from '../render/viewkit';

interface BlackHoleProps {
  /** Event horizon radius: light inside is gone. */
  horizon: number;
  /** How strongly it bends passing light. */
  mass: number;
}

interface Dust {
  sprite: Sprite;
  angle: number;
  radius: number;
  speed: number;
}

const blackHole: ElementDef<BlackHoleProps> = {
  type: 'black-hole',
  label: 'Black hole',
  icon: Orbit,
  category: 'field',
  description: 'Bends light that passes nearby and swallows anything crossing the event horizon.',
  rotatable: false,
  defaults: () => ({ horizon: 26, mass: 1 }),
  normalize: (p) => ({ horizon: clamp(p.horizon, 8, 120), mass: clamp(p.mass, 0.1, 4) }),
  params: [
    { kind: 'number', key: 'horizon', label: 'Event horizon', min: 8, max: 120, step: 1 },
    { kind: 'number', key: 'mass', label: 'Mass (bending)', min: 0.1, max: 4, step: 0.05 },
  ],

  boundsRadius: (p) => p.horizon * 1.6,
  hitTest: (p, l) => Math.hypot(l.x, l.y) <= p.horizon * 1.6,
  handles: (p) => [{ id: 'horizon', position: { x: p.horizon * 1.6, y: 0 }, drag: (_p, l) => ({ horizon: Math.hypot(l.x, l.y) / 1.6 }) }],
  field: (p) => ({ strength: p.mass, horizon: p.horizon }),

  createView: ({ textures }) => {
    let disk: Sprite;
    let disk2: Sprite;
    let ring: Sprite;
    const dustLayer = new Container();
    const dust: Dust[] = [];
    let spin = 0;

    const respawn = (d: Dust, r: number, initial: boolean) => {
      d.angle = Math.random() * Math.PI * 2;
      d.radius = initial ? r * (1.2 + Math.random() * 3.5) : r * (3.6 + Math.random() * 1.2);
      d.speed = 0.6 + Math.random() * 0.8;
    };

    return graphicsView<BlackHoleProps>(
      (g, p) => {
        const r = p.horizon;
        g.circle(0, 0, r * 1.35).fill({ color: 0x000000, alpha: 0.35 });
        g.circle(0, 0, r * 1.12).fill({ color: 0x000000, alpha: 0.7 });
        g.circle(0, 0, r).fill(0x000000);
      },
      {
        setup: (root) => {
          disk = new Sprite(textures.disk);
          disk2 = new Sprite(textures.disk);
          ring = new Sprite(textures.photonRing);
          for (const s of [disk, disk2, ring]) {
            s.anchor.set(0.5);
            s.blendMode = 'add';
          }
          disk2.alpha = 0.45;
          dustLayer.blendMode = 'add';
          // Glow underneath, black core (graphics) on top, photon ring hugging the edge.
          root.addChildAt(disk, 0);
          root.addChildAt(disk2, 1);
          root.addChildAt(dustLayer, 2);
          root.addChild(ring);
          for (let i = 0; i < 36; i++) {
            const s = new Sprite(textures.glow);
            s.anchor.set(0.5);
            s.blendMode = 'add';
            s.tint = i % 3 ? 0xffb070 : 0xfff0d8;
            dustLayer.addChild(s);
            dust.push({ sprite: s, angle: 0, radius: 0, speed: 1 });
          }
        },
        update: (el) => {
          const r = el.props.horizon;
          const size = r * (7.5 + 1.5 * el.props.mass);
          disk.scale.set(size / 1024);
          disk2.scale.set((size * 0.8) / 1024, (-size * 0.8) / 1024);
          ring.scale.set((r * 2.9) / 512);
          if (!dust[0].radius) for (const d of dust) respawn(d, r, true);
        },
        tick: (dt, el) => {
          const r = el.props.horizon;
          spin += dt;
          disk.rotation = spin * 0.35;
          disk2.rotation = -spin * 0.22;
          ring.alpha = 0.85 + 0.15 * Math.sin(spin * 2.3);
          dustLayer.visible = settings.particles;
          if (!settings.particles) return;
          for (const d of dust) {
            // Kepler-ish: faster closer in, slowly spiralling inward.
            const w = (d.speed * 2.2 * Math.pow(r / d.radius, 1.5)) * 2.5;
            d.angle += w * dt;
            d.radius -= dt * r * 0.25 * (r / d.radius) * 2;
            if (d.radius < r * 1.05) respawn(d, r, false);
            const fade = Math.min(1, (d.radius - r) / (r * 0.6));
            d.sprite.position.set(Math.cos(d.angle) * d.radius, Math.sin(d.angle) * d.radius * 0.92);
            d.sprite.alpha = fade * 0.8;
            d.sprite.scale.set((3 + 4 * (r / d.radius)) / 256 * 3);
          }
        },
      },
    );
  },
};


export default blackHole;
