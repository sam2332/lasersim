import { Container, Graphics, Sprite } from 'pixi.js';
import type { Vec2 } from '../core/math';
import { settings } from '../core/settings';
import { warpPoint, type WorldField } from '../optics/gravity';
import type { Textures } from './textures';

const MINOR = 20;
const MAJOR = 100;
const SAMPLE = 8;

/** The board: dark panel, two-level grid that warps around black holes, and a vignette. */
export class Background {
  readonly root = new Container();
  private panel = new Graphics();
  private minor = new Graphics();
  private major = new Graphics();
  private frame = new Graphics();
  private vignette: Sprite;
  private key = '';

  constructor(textures: Textures) {
    this.vignette = new Sprite(textures.vignette);
    this.root.addChild(this.panel, this.minor, this.major, this.vignette, this.frame);
  }

  update(board: { width: number; height: number }, fields: WorldField[]): void {
    const key = JSON.stringify([board, settings.grid, fields.map((f) => [f.x, f.y, f.k, f.horizon])]);
    if (key === this.key) return;
    this.key = key;
    const { width: W, height: H } = board;

    this.panel.clear().rect(0, 0, W, H).fill(0x0c0f15);
    this.vignette.position.set(0, 0);
    this.vignette.width = W;
    this.vignette.height = H;

    this.frame
      .clear()
      .roundRect(-6, -6, W + 12, H + 12, 10)
      .stroke({ width: 10, color: 0x000000, alpha: 0.55 })
      .roundRect(-1, -1, W + 2, H + 2, 4)
      .stroke({ width: 1.5, color: 0x3c4658, alpha: 0.9 });

    this.minor.clear();
    this.major.clear();
    if (!settings.grid) return;

    const line = (g: Graphics, a: Vec2, b: Vec2) => {
      if (!fields.length) {
        g.moveTo(a.x, a.y).lineTo(b.x, b.y);
        return;
      }
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(len / SAMPLE));
      const p0 = warpPoint(a, fields);
      g.moveTo(p0.x, p0.y);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const p = warpPoint({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, fields);
        g.lineTo(p.x, p.y);
      }
    };

    for (let x = MINOR; x < W; x += MINOR) line(x % MAJOR === 0 ? this.major : this.minor, { x, y: 0 }, { x, y: H });
    for (let y = MINOR; y < H; y += MINOR) line(y % MAJOR === 0 ? this.major : this.minor, { x: 0, y }, { x: W, y });
    this.minor.stroke({ width: 1, color: 0x8ea3c7, alpha: 0.07 });
    this.major.stroke({ width: 1.6, color: 0x9fb4d8, alpha: 0.16 });
  }
}
