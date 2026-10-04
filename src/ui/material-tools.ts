import { Graphics } from 'pixi.js';
import { Bomb, Eraser, Flame, MousePointer2, Paintbrush, Snowflake, Thermometer, type IconNode } from 'lucide';
import type { Vec2 } from '../core/math';
import type { Store } from '../core/store';
import type { SceneElement } from '../core/types';
import type { Editor } from '../editor/editor';
import { MATERIALS, MAT_INDEX } from '../matter/materials';
import { fieldWorld } from '../matter/world';
import type { Stage } from '../render/stage';
import { icon } from './icons';

type Tool = 'select' | 'draw' | 'erase' | 'heat' | 'cool' | 'ignite' | 'explode';

const TOOLS: { id: Tool; label: string; icon: IconNode; color: number }[] = [
  { id: 'select', label: 'Select / move (normal editing)', icon: MousePointer2, color: 0xffffff },
  { id: 'draw', label: 'Draw material', icon: Paintbrush, color: 0x6dff9c },
  { id: 'erase', label: 'Erase (back to air)', icon: Eraser, color: 0xff6a6a },
  { id: 'heat', label: 'Heat (+600 K/s)', icon: Thermometer, color: 0xff9a3c },
  { id: 'cool', label: 'Cool (−600 K/s)', icon: Snowflake, color: 0x6fc8ff },
  { id: 'ignite', label: 'Ignite (flame torch)', icon: Flame, color: 0xffc04a },
  { id: 'explode', label: 'Explosion (1 MJ, ~0.25 kg TNT)', icon: Bomb, color: 0xff4040 },
];

interface Stroke {
  id: string;
  pointer: Vec2;
  changed: boolean;
}

/** Toolbar + brushes for material fields (sits under the particle toolbar). */
export class MaterialTools {
  private readonly bar = document.createElement('div');
  private readonly cursor = new Graphics();
  private tool: Tool = 'select';
  private material = MAT_INDEX.concrete;
  /** Brush radius in cells. */
  private radius = 4;
  private stroke: Stroke | null = null;
  private hoverPoint: Vec2 | null = null;
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
      move: (w) => {
        this.hoverPoint = w;
        if (this.stroke) this.stroke.pointer = w;
      },
      up: () => this.up(),
      hover: (w) => {
        this.hoverPoint = w;
      },
    });
    store.events.on('change', () => this.syncVisibility());
    this.syncVisibility();
  }

  update(dt: number): void {
    this.drawCursor();
    const s = this.stroke;
    if (!s) return;
    const el = this.store.get(s.id);
    const f = el && fieldWorld.get(el.id);
    if (!el || !f) return;
    const c = this.toCell(el, s.pointer);
    const r = this.radius;
    switch (this.tool) {
      case 'draw': {
        const m = MATERIALS[this.material];
        // Loose materials are sprinkled so they fall naturally; solids are laid solid.
        f.paint(c.x, c.y, r, this.material, m.phase === 'solid' ? 1 : 0.5);
        s.changed = true;
        break;
      }
      case 'erase':
        f.paint(c.x, c.y, r, 0);
        s.changed = true;
        break;
      case 'heat':
        f.addHeat(c.x, c.y, r, 600 * dt);
        break;
      case 'cool':
        f.addHeat(c.x, c.y, r, -600 * dt);
        break;
      case 'ignite':
        f.brush(c.x, c.y, r, (i) => {
          if (f.mat[i] === 0) {
            if (Math.random() < 0.3) f.set(i, MAT_INDEX.fire);
          } else f.T[i] = Math.max(f.T[i], 900);
        });
        break;
    }
  }

  private down(w: Vec2): boolean {
    if (this.tool === 'select') return false;
    const el = this.fieldAt(w);
    if (!el) return false;
    this.stroke = { id: el.id, pointer: w, changed: false };
    if (this.tool === 'explode') {
      const f = fieldWorld.get(el.id);
      const c = this.toCell(el, w);
      f?.explode(c.x, c.y, 1e6);
      this.stroke.changed = true;
    }
    return true;
  }

  private up(): void {
    const s = this.stroke;
    this.stroke = null;
    if (s?.changed) this.store.updateProps(s.id, { data: fieldWorld.takeSnapshot(s.id) });
  }

  private fieldAt(w: Vec2): SceneElement | undefined {
    const els = this.store.scene.elements;
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i];
      if (el.type !== 'material-field') continue;
      if (Math.abs(w.x - el.x) <= (el.props.width as number) / 2 && Math.abs(w.y - el.y) <= (el.props.height as number) / 2) return el;
    }
    return undefined;
  }

  private toCell(el: SceneElement, w: Vec2): Vec2 {
    const f = fieldWorld.get(el.id)!;
    const cs = el.props.cellPx as number;
    return { x: (w.x - (el.x - (f.cols * cs) / 2)) / cs, y: (w.y - (el.y - (f.rows * cs) / 2)) / cs };
  }

  private drawCursor(): void {
    const g = this.cursor.clear();
    const p = this.stroke?.pointer ?? this.hoverPoint;
    const el = p && this.tool !== 'select' ? this.fieldAt(p) : undefined;
    if (!p || !el) return;
    const color = TOOLS.find((t) => t.id === this.tool)!.color;
    const s = 1 / this.stage.viewport.scale.x;
    const r = this.radius * (el.props.cellPx as number);
    g.circle(p.x, p.y, r).fill({ color, alpha: 0.08 }).stroke({ width: 1.5 * s, color, alpha: 0.9 });
  }

  private buildBar(host: HTMLElement): void {
    this.bar.className = 'particle-bar material-bar';
    const title = document.createElement('span');
    title.className = 'particle-bar-title';
    title.textContent = 'Materials';
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
    const select = document.createElement('select');
    select.className = 'preset-select';
    const groups = [...new Set(MATERIALS.slice(1).map((m) => m.group))];
    select.innerHTML = groups
      .map((g) => `<optgroup label="${g}">${MATERIALS.map((m, i) => (i > 0 && m.group === g ? `<option value="${i}">${m.name}</option>` : '')).join('')}</optgroup>`)
      .join('');
    select.value = String(this.material);
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    const sync = () => {
      const m = MATERIALS[this.material];
      swatch.style.background = `#${m.color.toString(16).padStart(6, '0')}`;
      const facts = [
        `${m.density} kg/m³`,
        m.melt ? `melts ${Math.round(m.melt.at)} K` : '',
        m.freeze ? `freezes ${Math.round(m.freeze.at)} K` : '',
        m.boil ? `boils ${Math.round(m.boil.at)} K` : '',
        m.burn ? `ignites ${m.burn.at} K` : '',
        m.explosive ? `detonates ${m.explosive.at} K` : '',
      ].filter(Boolean);
      select.title = `${m.name}: ${facts.join(', ')}`;
    };
    select.addEventListener('change', () => {
      this.material = Number(select.value);
      sync();
      if (this.tool === 'select') this.setTool('draw');
    });
    sync();
    const size = document.createElement('label');
    size.className = 'particle-field';
    size.innerHTML = '<span>Brush</span>';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '1';
    range.max = '30';
    range.value = String(this.radius);
    range.addEventListener('input', () => (this.radius = Number(range.value)));
    size.append(range);
    this.bar.append(swatch, select, size);
    host.append(this.bar);
    this.setTool('select');
  }

  private setTool(t: Tool): void {
    this.tool = t;
    for (const [id, b] of this.buttons) b.classList.toggle('active', id === t);
  }

  private syncVisibility(): void {
    const has = this.store.scene.elements.some((e) => e.type === 'material-field');
    this.bar.hidden = !has;
    // Sit below the particle toolbar when both are shown.
    const both = has && this.store.scene.elements.some((e) => e.type === 'chamber');
    this.bar.style.top = both ? '62px' : '12px';
    if (!has && this.tool !== 'select') this.setTool('select');
  }
}
