import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Layers3 } from 'lucide';
import { clamp } from '../core/math';
import type { ElementDef, ElementView, SceneElement } from '../core/types';
import { PHASE_OF } from '../matter/field';
import { AMBIENT, MATERIALS } from '../matter/materials';
import { fieldWorld, type FieldProps } from '../matter/world';

/** Blackbody colour (approximate) for glowing materials. */
function blackbody(T: number): [number, number, number] {
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v: number) => clamp(v, 0, 255);
  return [c(r), c(g), c(b)];
}

const BASE = MATERIALS.map((m) => [(m.color >> 16) & 255, (m.color >> 8) & 255, m.color & 255]);
const GRAIN = MATERIALS.map((m) => m.grain);
const ALPHA = MATERIALS.map((m) => (m.phase === 'empty' ? 0 : m.key === 'smoke' ? 200 : m.key === 'steam' ? 110 : m.key === 'water' ? 215 : m.optics === 'clear' && m.phase === 'solid' ? 140 : 255));

/**
 * A region of macro-scale matter: draw structures, sand, water, metal… with
 * the material tools. Heat, melting, burning and explosions are simulated per
 * cell; lasers heat what they hit.
 */
const materialField: ElementDef<FieldProps> = {
  type: 'material-field',
  label: 'Material field',
  icon: Layers3,
  category: 'matter',
  order: 2,
  description:
    'A sandbox of real materials (5 cm cells): build with the material tools at the top of the board. Things fall, flow, conduct heat, melt, burn and explode using real material data. Lasers heat whatever they hit.',
  defaults: () => ({ width: 1200, height: 640, cellPx: 4, dx: 0.05, timeScale: 30, beamWatts: 25000, ambient: AMBIENT, layout: [], data: '' }),
  normalize: (p) => ({
    ...p,
    width: clamp(p.width, 80, 1780),
    height: clamp(p.height, 80, 1080),
    cellPx: clamp(Math.round(p.cellPx), 2, 12),
    timeScale: clamp(p.timeScale, 1, 600),
    layout: Array.isArray(p.layout) ? p.layout : [],
    data: typeof p.data === 'string' ? p.data : '',
  }),
  params: [
    { kind: 'number', key: 'timeScale', label: 'Heat time scale (×)', min: 1, max: 600, step: 1 },
    { kind: 'number', key: 'beamWatts', label: 'Beam power (W per unit)', min: 100, max: 200000, step: 100 },
    { kind: 'number', key: 'ambient', label: 'Ambient temperature (K)', min: 1, max: 1500, step: 1 },
    { kind: 'number', key: 'dx', label: 'Cell size (m)', min: 0.005, max: 2, step: 0.005 },
    { kind: 'number', key: 'cellPx', label: 'Pixels per cell', min: 2, max: 12, step: 1 },
    { kind: 'number', key: 'width', label: 'Width', min: 80, max: 1780, step: 4 },
    { kind: 'number', key: 'height', label: 'Height', min: 80, max: 1080, step: 4 },
  ],
  info: (_p, id) => {
    const f = fieldWorld.get(id);
    return {
      Grid: f ? `${f.cols} × ${f.rows} cells` : '—',
      Hottest: f ? `${Math.round(f.maxTemperature())} K` : '—',
      Explosions: f ? String(f.explosions) : '0',
    };
  },
  liveInfo: true,
  rotatable: false,

  boundsRadius: (p) => Math.hypot(p.width, p.height) / 2,
  hitTest: (p, l) => Math.abs(l.x) <= p.width / 2 + 2 && Math.abs(l.y) <= p.height / 2 + 2,
  handles: (p) => [{ id: 'corner', position: { x: p.width / 2, y: p.height / 2 }, drag: (_p, l) => ({ width: Math.abs(l.x) * 2, height: Math.abs(l.y) * 2 }) }],
  medium: {
    trace: (el, o, d, tMax) => fieldWorld.traceRay(el, o, d, tMax),
    absorb: (el, cell, intensity) => fieldWorld.deposit(el.id, cell, intensity * (el.props.beamWatts as number)),
    reflectivity: 0.9,
  },

  createView: ({ light }): ElementView<FieldProps> => {
    const root = new Container();
    const frame = new Graphics();
    let canvas = document.createElement('canvas');
    let glowCanvas = document.createElement('canvas');
    let tex: Texture | null = null;
    let glowTex: Texture | null = null;
    const sprite = new Sprite();
    const glow = new Sprite();
    glow.blendMode = 'add';
    root.addChild(frame, sprite);
    light.addChild(glow);
    let size = '';
    let image: ImageData | null = null;
    let glowImage: ImageData | null = null;

    const ensure = (cols: number, rows: number) => {
      const key = `${cols}x${rows}`;
      if (key === size) return;
      size = key;
      tex?.destroy(true);
      glowTex?.destroy(true);
      canvas = document.createElement('canvas');
      glowCanvas = document.createElement('canvas');
      canvas.width = glowCanvas.width = cols;
      canvas.height = glowCanvas.height = rows;
      image = canvas.getContext('2d')!.createImageData(cols, rows);
      glowImage = glowCanvas.getContext('2d')!.createImageData(cols, rows);
      tex = Texture.from(canvas);
      glowTex = Texture.from(glowCanvas);
      tex.source.scaleMode = 'nearest';
      glowTex.source.scaleMode = 'linear';
      sprite.texture = tex;
      glow.texture = glowTex;
    };

    const render = (el: SceneElement<FieldProps>) => {
      const f = fieldWorld.get(el.id);
      if (!f) return;
      ensure(f.cols, f.rows);
      const px = image!.data;
      const gx = glowImage!.data;
      const { mat, T, shade } = f;
      const flicker = Math.random();
      for (let i = 0; i < f.n; i++) {
        const m = mat[i];
        const o = i * 4;
        const t = T[i];
        if (m === 0) {
          // Air: invisible unless it is hot (heat shimmer).
          const hot = clamp((t - 450) / 900, 0, 1);
          px[o] = 255;
          px[o + 1] = 120;
          px[o + 2] = 40;
          px[o + 3] = hot * 70;
          gx[o + 3] = 0;
          continue;
        }
        const [r, g, b] = BASE[m];
        const v = 1 - GRAIN[m] / 2 + (GRAIN[m] * shade[i]) / 255;
        let R = r * v;
        let G = g * v;
        let B = b * v;
        let A = ALPHA[m];
        const ph = PHASE_OF[m];
        let glowA = 0;
        if (ph === 5) {
          // Flames: blackbody colour with flicker.
          const [fr, fg, fb] = blackbody(t * (0.85 + 0.3 * ((shade[i] / 255 + flicker) % 1)));
          R = fr;
          G = fg;
          B = fb;
          A = 230;
          glowA = 200;
        } else if (t > 750) {
          // Incandescence: hot matter glows (Draper point ~800 K).
          const k = clamp((t - 750) / 1100, 0, 1);
          const [hr, hg, hb] = blackbody(t);
          R = R * (1 - k) + hr * k;
          G = G * (1 - k) + hg * k;
          B = B * (1 - k) + hb * k;
          glowA = clamp((t - 850) / 1500, 0, 1) * 220;
        }
        px[o] = R;
        px[o + 1] = G;
        px[o + 2] = B;
        px[o + 3] = A;
        if (glowA > 0) {
          const [hr, hg, hb] = blackbody(Math.max(t, 1000));
          gx[o] = hr;
          gx[o + 1] = hg;
          gx[o + 2] = hb;
          gx[o + 3] = glowA;
        } else gx[o + 3] = 0;
      }
      canvas.getContext('2d')!.putImageData(image!, 0, 0);
      glowCanvas.getContext('2d')!.putImageData(glowImage!, 0, 0);
      tex!.source.update();
      glowTex!.source.update();
    };

    let frameKey = '';
    return {
      root,
      update(el, state) {
        const p = el.props;
        const key = `${p.width}|${p.height}|${state.selected}`;
        if (key !== frameKey) {
          frameKey = key;
          frame.clear();
          frame.rect(-p.width / 2, -p.height / 2, p.width, p.height).fill({ color: 0x080a0f, alpha: 0.7 }).stroke({ width: 1.5, color: 0x3c4658 });
        }
        const f = fieldWorld.get(el.id);
        if (f) {
          const w = f.cols * p.cellPx;
          const h = f.rows * p.cellPx;
          sprite.position.set(-w / 2, -h / 2);
          sprite.width = w;
          sprite.height = h;
          glow.position.set(el.x - w / 2, el.y - h / 2);
          glow.width = w;
          glow.height = h;
        }
      },
      tick(_dt, el) {
        render(el);
        const f = fieldWorld.get(el.id);
        if (f) glow.position.set(el.x - (f.cols * el.props.cellPx) / 2, el.y - (f.rows * el.props.cellPx) / 2);
      },
      destroy() {
        glow.destroy();
        tex?.destroy(true);
        glowTex?.destroy(true);
      },
    };
  },
};

export default materialField;
