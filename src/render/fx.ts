import { Container, Sprite, type Texture } from 'pixi.js';
import { settings } from '../core/settings';

export interface BurstOptions {
  count?: number;
  color?: number;
  speed?: number;
  life?: number;
  size?: number;
  /** Constant acceleration, e.g. gravity for falling sparks. */
  gravity?: number;
  /** Emission direction in radians and spread around it (default: all directions). */
  angle?: number;
  spread?: number;
}

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
}

const MAX_PARTICLES = 1500;

/** Lightweight pooled particle system for sparks and embers (additive, bloomed). */
export class FxSystem {
  readonly root = new Container();
  private live: Particle[] = [];
  private pool: Sprite[] = [];

  constructor(private readonly texture: Texture) {
    this.root.blendMode = 'add';
  }

  burst(x: number, y: number, opts: BurstOptions = {}): void {
    if (!settings.particles) return;
    const { count = 20, color = 0xffd27a, speed = 160, life = 0.8, size = 10, gravity = 0, angle, spread = Math.PI * 2 } = opts;
    for (let i = 0; i < count && this.live.length < MAX_PARTICLES; i++) {
      const sprite = this.pool.pop() ?? this.makeSprite();
      const a = angle === undefined ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * spread;
      const v = speed * (0.3 + Math.random() * 0.7);
      sprite.tint = color;
      sprite.position.set(x, y);
      sprite.visible = true;
      const l = life * (0.5 + Math.random() * 0.5);
      this.live.push({ sprite, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, maxLife: l, size: size * (0.5 + Math.random() * 0.6), gravity });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.pool.push(p.sprite);
        this.live.splice(i, 1);
        continue;
      }
      const drag = Math.exp(-2.2 * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      const k = p.life / p.maxLife;
      p.sprite.alpha = k;
      p.sprite.scale.set((p.size * (0.4 + 0.6 * k)) / 256);
    }
  }

  private makeSprite(): Sprite {
    const s = new Sprite(this.texture);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    this.root.addChild(s);
    return s;
  }
}
