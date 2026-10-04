import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { beamColor, lighten } from '../optics/spectrum';
import type { TraceResult } from '../optics/tracer';

/**
 * Draws traced light: a wide soft halo, a coloured body and a hot white-ish
 * core per path, all additive so crossing beams mix like real light.
 */
export class BeamRenderer {
  readonly root = new Container();
  private halo = new Graphics();
  private body = new Graphics();
  private core = new Graphics();
  private glintLayer = new Container();
  private glints: Sprite[] = [];

  constructor(private readonly glintTexture: Texture) {
    for (const g of [this.halo, this.body, this.core]) g.blendMode = 'add';
    this.glintLayer.blendMode = 'add';
    this.root.addChild(this.halo, this.body, this.core, this.glintLayer);
  }

  draw(result: TraceResult): void {
    this.halo.clear();
    this.body.clear();
    this.core.clear();

    for (const path of result.paths) {
      const pts = path.points;
      if (pts.length < 2) continue;
      const color = beamColor(path.wavelength);
      const k = Math.min(1, path.intensity);
      const trace = (g: Graphics) => {
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      };
      trace(this.halo);
      this.halo.stroke({ width: 16, color, alpha: 0.05 * k, cap: 'round', join: 'round' });
      trace(this.body);
      this.body.stroke({ width: 4.5, color, alpha: 0.38 * k, cap: 'round', join: 'round' });
      trace(this.core);
      this.core.stroke({ width: 1.6, color: lighten(color, 0.55), alpha: 0.95 * k, cap: 'round', join: 'round' });
    }

    let used = 0;
    for (const g of result.glints) {
      if (g.intensity < 0.08) continue;
      const s = this.glints[used] ?? this.makeGlint();
      s.visible = true;
      s.position.set(g.point.x, g.point.y);
      s.tint = lighten(beamColor(g.wavelength), 0.3);
      s.alpha = Math.min(1, 0.35 + 0.5 * g.intensity);
      s.scale.set((26 + 18 * Math.min(1, g.intensity)) / 256);
      s.rotation = (g.point.x * 0.013 + g.point.y * 0.007) % Math.PI;
      used++;
    }
    for (let i = used; i < this.glints.length; i++) this.glints[i].visible = false;
  }

  private makeGlint(): Sprite {
    const s = new Sprite(this.glintTexture);
    s.anchor.set(0.5);
    s.blendMode = 'add';
    this.glintLayer.addChild(s);
    this.glints.push(s);
    return s;
  }
}
