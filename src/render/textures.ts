import { Texture } from 'pixi.js';

/** Procedurally painted textures (no image assets to manage). */
export interface Textures {
  glow: Texture;
  flare: Texture;
  disk: Texture;
  photonRing: Texture;
  vignette: Texture;
  orb: Texture;
}

function paint(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  return Texture.from(canvas);
}

function radial(ctx: CanvasRenderingContext2D, s: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

export function createTextures(): Textures {
  const glow = paint(256, (ctx, s) =>
    radial(ctx, s, [
      [0, 'rgba(255,255,255,1)'],
      [0.12, 'rgba(255,255,255,0.65)'],
      [0.35, 'rgba(255,255,255,0.18)'],
      [0.7, 'rgba(255,255,255,0.04)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );

  const flare = paint(256, (ctx, s) => {
    radial(ctx, s, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.1, 'rgba(255,255,255,0.35)'],
      [0.3, 'rgba(255,255,255,0.05)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.globalCompositeOperation = 'lighter';
    for (const horizontal of [true, false]) {
      const g = horizontal
        ? ctx.createLinearGradient(0, 0, s, 0)
        : ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      if (horizontal) ctx.fillRect(0, s / 2 - 1.5, s, 3);
      else ctx.fillRect(s / 2 - 1.5, 0, 3, s);
    }
  });

  const disk = paint(1024, (ctx, s) => {
    const c = s / 2;
    ctx.translate(c, c);
    // Soft accretion glow.
    const base = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 0.5);
    base.addColorStop(0, 'rgba(255,190,120,0)');
    base.addColorStop(0.22, 'rgba(255,170,90,0.55)');
    base.addColorStop(0.35, 'rgba(255,120,60,0.25)');
    base.addColorStop(0.65, 'rgba(160,60,180,0.08)');
    base.addColorStop(1, 'rgba(60,20,120,0)');
    ctx.fillStyle = base;
    ctx.fillRect(-c, -c, s, s);
    // Spiral streaks.
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(1.5px)';
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 260; i++) {
      const r0 = s * (0.11 + rand() * 0.34);
      const a0 = rand() * Math.PI * 2;
      const span = 0.4 + rand() * 1.4;
      const heat = 1 - (r0 / s - 0.11) / 0.34;
      const alpha = 0.06 + rand() * 0.22 * (0.4 + heat);
      const hue = 18 + heat * 26;
      ctx.strokeStyle = `hsla(${hue}, 100%, ${55 + heat * 35}%, ${alpha})`;
      ctx.lineWidth = 0.6 + rand() * 2.4 * (0.5 + heat);
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const a = a0 + span * t;
        const r = r0 * (1 - 0.18 * t);
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
    }
  });

  const photonRing = paint(512, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, s * 0.28, c, c, s * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.18, 'rgba(255,240,220,0.95)');
    g.addColorStop(0.3, 'rgba(255,200,140,0.35)');
    g.addColorStop(0.6, 'rgba(255,150,90,0.06)');
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const vignette = paint(512, (ctx, s) =>
    radial(ctx, s, [
      [0, 'rgba(0,0,0,0)'],
      [0.55, 'rgba(0,0,0,0.08)'],
      [0.85, 'rgba(0,0,0,0.45)'],
      [1, 'rgba(0,0,0,0.75)'],
    ]),
  );

  // Glassy sphere shading, tinted per use.
  const orb = paint(256, (ctx, s) => {
    const c = s / 2;
    const body = ctx.createRadialGradient(c * 0.75, c * 0.7, s * 0.02, c, c, s * 0.5);
    body.addColorStop(0, 'rgba(255,255,255,1)');
    body.addColorStop(0.25, 'rgba(235,235,235,1)');
    body.addColorStop(0.75, 'rgba(120,120,120,1)');
    body.addColorStop(1, 'rgba(40,40,40,1)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(c, c, s * 0.48, 0, Math.PI * 2);
    ctx.fill();
  });

  return { glow, flare, disk, photonRing, vignette, orb };
}
