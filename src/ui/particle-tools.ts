import { Graphics } from 'pixi.js';
import { Eraser, Flame, MousePointer2, Snowflake, Sparkles, Wind, type IconNode } from 'lucide';
import { bus } from '../core/bus';
import type { Vec2 } from '../core/math';
import type { Store } from '../core/store';
import type { SceneElement } from '../core/types';
import type { Editor } from '../editor/editor';
import { SPECIES, sigmaPx } from '../particles/species';
import { particleWorld, WALL } from '../particles/world';
import type { Stage } from '../render/stage';
import { icon } from './icons';

type Tool = 'select' | 'spawn' | 'erase' | 'heat' | 'cool' | 'push';

const TOOLS: { id: Tool; label: string; icon: IconNode; color: number }[] = [
  { id: 'select', label: 'Select / move (normal editing)', icon: MousePointer2, color: 0xffffff },
  { id: 'spawn', label: 'Spawn particles', icon: Sparkles, color: 0x6dff9c },
  { id: 'erase', label: 'Erase particles', icon: Eraser, color: 0xff6a6a },
  { id: 'heat', label: 'Heat (speed molecules up)', icon: Flame, color: 0xff9a3c },
  { id: 'cool', label: 'Cool (slow molecules down)', icon: Snowflake, color: 0x6fc8ff },
  { id: 'push', label: 'Push / stir', icon: Wind, color: 0xd8b8ff },
];

interface Stroke {
  id: string;
  pointer: Vec2;
  last: Vec2;
  changed: boolean;
}

/**
 * Floating particle toolbar + brushes. Brushes act continuously while the
 * pointer is held inside a chamber; spawn/erase edits are saved to the scene
 * (undoable) when the stroke ends.
 */
export class ParticleTools {
  private readonly bar = document.createElement('div');
  private readonly cursor = new Graphics();
  private tool: Tool = 'select';
  private species = SPECIES.findIndex((s) => s.id === 'ar');
  private radius = 40;
  private spawnT = 293;
  private stroke: Stroke | null = null;
  private hoverPoint: Vec2 | null = null;
  private spawnDebt = 0;
  private buttons = new Map<Tool, HTMLButtonElement>();

  constructor(
    host: HTMLElement,
    private readonly stage: Stage,
    private readonly store: Store,
    editor: Editor,
  ) {
    this.buildBar(host);
    stage.layers.overlay.addChild(this.cursor);
    editor.addInterceptor({
      down: (w) => this.down(w),
      move: (w) => this.move(w),
      up: () => this.up(),
      hover: (w) => {
        this.hoverPoint = w;
      },
    });
    store.events.on('change', () => this.syncVisibility());
    bus.on('clear-chamber', (id) => {
      particleWorld.get(id)?.clear();
      this.store.updateProps(id, { particles: '', fill: [] });
    });
    this.syncVisibility();
  }

  /** Apply the active brush (called every frame). */
  update(dt: number): void {
    this.drawCursor();
    const s = this.stroke;
    if (!s) return;
    const sim = particleWorld.get(s.id);
    const el = this.store.get(s.id);
    if (!sim || !el) return;
    const p = this.toLocal(el, s.pointer);
    const r = this.radius;
    switch (this.tool) {
      case 'spawn': {
        // ~ brush area / molecule area per second, so big brushes fill faster.
        const sig = sigmaPx(SPECIES[this.species]);
        this.spawnDebt += dt * Math.max(20, (r * r) / (sig * sig)) * 2;
        for (; this.spawnDebt >= 1; this.spawnDebt--) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * r;
          if (sim.spawn(this.species, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, this.spawnT)) s.changed = true;
        }
        break;
      }
      case 'erase':
        if (sim.removeInRadius(p.x, p.y, r)) s.changed = true;
        break;
      case 'heat':
        sim.scaleVelocities(p.x, p.y, r, 1 + 1.2 * dt);
        break;
      case 'cool':
        sim.scaleVelocities(p.x, p.y, r, Math.max(0.5, 1 - 1.2 * dt));
        break;
      case 'push': {
        const dx = s.pointer.x - s.last.x;
        const dy = s.pointer.y - s.last.y;
        if (dt > 0) sim.push(p.x, p.y, r, (dx / dt) * 0.02, (dy / dt) * 0.02);
        break;
      }
    }
    s.last = { ...s.pointer };
  }

  // ---------------------------------------------------------------- pointer

  private down(w: Vec2): boolean {
    if (this.tool === 'select') return false;
    const el = this.chamberAt(w);
    if (!el) return false;
    this.stroke = { id: el.id, pointer: w, last: w, changed: false };
    this.spawnDebt = 1;
    return true;
  }

  private move(w: Vec2): void {
    this.hoverPoint = w;
    if (this.stroke) this.stroke.pointer = w;
  }

  private up(): void {
    const s = this.stroke;
    this.stroke = null;
    if (s?.changed) this.store.updateProps(s.id, { particles: particleWorld.takeSnapshot(s.id), fill: [] });
  }

  private chamberAt(w: Vec2): SceneElement | undefined {
    const els = this.store.scene.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.type !== 'chamber') continue;
      const hw = (el.props.width as number) / 2;
      const hh = (el.props.height as number) / 2;
      if (Math.abs(w.x - el.x) <= hw && Math.abs(w.y - el.y) <= hh) return el;
    }
    return undefined;
  }

  private toLocal(el: SceneElement, w: Vec2): Vec2 {
    return { x: w.x - (el.x - (el.props.width as number) / 2 + WALL), y: w.y - (el.y - (el.props.height as number) / 2 + WALL) };
  }

  private drawCursor(): void {
    const g = this.cursor.clear();
    const p = this.stroke?.pointer ?? this.hoverPoint;
    if (this.tool === 'select' || !p || !this.chamberAt(p)) return;
    const color = TOOLS.find((t) => t.id === this.tool)!.color;
    const s = 1 / this.stage.viewport.scale.x;
    g.circle(p.x, p.y, this.radius).fill({ color, alpha: this.stroke ? 0.12 : 0.06 }).stroke({ width: 1.5 * s, color, alpha: 0.9 });
    if (this.tool === 'spawn') g.circle(p.x, p.y, sigmaPx(SPECIES[this.species]) / 2).fill(SPECIES[this.species].color);
  }

  // ---------------------------------------------------------------- toolbar

  private buildBar(host: HTMLElement): void {
    this.bar.className = 'particle-bar';
    const title = document.createElement('span');
    title.className = 'particle-bar-title';
    title.textContent = 'Particles';
    this.bar.append(title);

    for (const t of TOOLS) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.title = t.label;
      b.append(icon(t.icon, 17));
      b.addEventListener('click', () => this.setTool(t.id));
      this.buttons.set(t.id, b);
      this.bar.append(b);
    }

    const species = document.createElement('select');
    species.className = 'preset-select';
    species.title = 'Particle type';
    species.innerHTML = SPECIES.map((s, i) => `<option value="${i}">${s.formula} · ${s.name}</option>`).join('');
    species.value = String(this.species);
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const syncSwatch = () => {
      const sp = SPECIES[this.species];
      swatch.style.background = `#${sp.color.toString(16).padStart(6, '0')}`;
      species.title = `${sp.name}: ${sp.mass} u, σ ${sp.sigmaA} Å` + (sp.triple ? `, real triple point ${sp.triple} K` : '') + `, critical ${sp.critical} K`;
    };
    species.addEventListener('change', () => {
      this.species = Number(species.value);
      syncSwatch();
      if (this.tool === 'select') this.setTool('spawn');
    });
    syncSwatch();

    const size = this.labelled('Brush', 'range', String(this.radius), (v) => (this.radius = Number(v)), { min: '8', max: '200' });
    const temp = this.labelled('Spawn T (K)', 'number', String(this.spawnT), (v) => (this.spawnT = Math.max(1, Number(v) || 1)), { min: '1', max: '5000', step: '10' });
    this.bar.append(swatch, species, size, temp);
    host.append(this.bar);
    this.setTool('select');
  }

  private labelled(text: string, type: string, value: string, onInput: (v: string) => void, attrs: Record<string, string>): HTMLElement {
    const label = document.createElement('label');
    label.className = 'particle-field';
    const span = document.createElement('span');
    span.textContent = text;
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
    input.addEventListener('input', () => onInput(input.value));
    label.append(span, input);
    return label;
  }

  private setTool(t: Tool): void {
    this.tool = t;
    for (const [id, b] of this.buttons) b.classList.toggle('active', id === t);
    this.stage.app.canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
  }

  private syncVisibility(): void {
    const has = this.store.scene.elements.some((e) => e.type === 'chamber');
    this.bar.hidden = !has;
    if (!has && this.tool !== 'select') this.setTool('select');
  }
}
