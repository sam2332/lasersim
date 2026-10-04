import { Pane } from 'tweakpane';
import { deg, rad } from '../core/math';
import { getDef } from '../core/registry';
import { setSetting, settings } from '../core/settings';
import type { Store } from '../core/store';
import type { ElementDef, ParamSpec, Props, SceneElement } from '../core/types';
import type { Editor } from '../editor/editor';
import { VISIBLE_MAX, VISIBLE_MIN, wavelengthToRgb } from '../optics/spectrum';

type Model = Record<string, unknown>;

/**
 * Right-hand panel: an inspector generated from the selected element's
 * `params`, plus global settings. Built on Tweakpane.
 */
export class Inspector {
  private pane: Pane | null = null;
  private model: Model = {};
  private info: Model = {};
  private syncing = false;
  private boundId: string | null = null;
  private refreshQueued = false;
  private readonly elementHost: HTMLElement;

  constructor(
    host: HTMLElement,
    private readonly store: Store,
    private readonly editor: Editor,
    onFit: () => void,
  ) {
    this.elementHost = document.createElement('div');
    this.elementHost.className = 'panel';
    const settingsHost = document.createElement('div');
    settingsHost.className = 'panel';
    host.append(this.elementHost, settingsHost);

    this.buildSettings(settingsHost, onFit);
    store.events.on('select', () => this.rebuild());
    store.events.on('change', () => this.queueRefresh());
    this.rebuild();
  }

  private rebuild(): void {
    this.pane?.dispose();
    this.pane = null;
    this.elementHost.innerHTML = '';
    const el = this.store.selected;
    const def = el && getDef(el.type);
    this.boundId = el?.id ?? null;
    const wire = this.store.selectedWire;
    if (wire) {
      this.elementHost.append(this.wireCard(wire.from, wire.to, wire.id));
      return;
    }
    if (!el || !def) {
      this.elementHost.append(this.emptyState());
      return;
    }

    const pane = new Pane({ container: this.elementHost, title: def.label });
    this.pane = pane;
    this.model = this.toModel(el);

    if (def.description) {
      const p = document.createElement('div');
      p.className = 'panel-desc';
      p.textContent = def.description;
      this.elementHost.querySelector('.tp-rotv_c')?.prepend(p);
    }

    const { width, height } = this.store.scene.board;
    const transform = pane.addFolder({ title: 'Position', expanded: true });
    this.bind(transform, 'x', { min: 0, max: width, step: 1, label: 'X' }, 'transform');
    this.bind(transform, 'y', { min: 0, max: height, step: 1, label: 'Y' }, 'transform');
    if (def.rotatable !== false) this.bind(transform, 'rotation', { min: -180, max: 180, step: 1, label: 'Angle°' }, 'transform');

    if (def.params.length) {
      const folder = pane.addFolder({ title: 'Properties', expanded: true });
      for (const spec of def.params) this.bindParam(folder, spec);
    }

    if (def.info) {
      this.info = { ...def.info(el.props) };
      const folder = pane.addFolder({ title: 'Optics', expanded: true });
      for (const key of Object.keys(this.info)) folder.addBinding(this.info, key, { readonly: true, label: key });
    }

    const actions = pane.addFolder({ title: 'Actions', expanded: true });
    this.bind(actions, 'locked', { label: 'Locked' }, 'transform');
    if (def.activate) actions.addButton({ title: 'Toggle power (Space)' }).on('click', () => this.store.updateProps(el.id, def.activate!(el.props)));
    actions.addButton({ title: 'Duplicate (Ctrl+D)' }).on('click', () => this.editor.duplicate(this.store.selected!));
    actions.addButton({ title: 'Delete (Del)' }).on('click', () => this.store.remove(el.id));
  }

  private toModel(el: SceneElement): Model {
    return { ...el.props, x: Math.round(el.x), y: Math.round(el.y), rotation: Math.round(((((deg(el.rotation) + 180) % 360) + 360) % 360) - 180), locked: !!el.locked };
  }

  private bind(container: { addBinding: Pane['addBinding'] }, key: string, opts: Record<string, unknown>, kind: 'transform' | 'prop') {
    const binding = container.addBinding(this.model, key, opts);
    binding.on('change', (ev) => {
      if (this.syncing || !this.boundId) return;
      const value = ev.value as unknown;
      if (kind === 'transform') {
        const patch: Partial<SceneElement> = key === 'rotation' ? { rotation: rad(value as number) } : { [key]: value };
        this.store.update(this.boundId, patch, ev.last);
      } else {
        this.store.updateProps(this.boundId, { [key]: value } as Props, ev.last);
      }
    });
    return binding;
  }

  private bindParam(folder: { addBinding: Pane['addBinding'] }, spec: ParamSpec<Props>): void {
    switch (spec.kind) {
      case 'number':
        this.bind(folder, spec.key, { min: spec.min, max: spec.max, step: spec.step, label: spec.label }, 'prop');
        break;
      case 'boolean':
        this.bind(folder, spec.key, { label: spec.label }, 'prop');
        break;
      case 'select':
        this.bind(folder, spec.key, { label: spec.label, options: spec.options }, 'prop');
        break;
      case 'text':
        this.bind(folder, spec.key, { label: spec.label, view: spec.multiline ? 'textarea' : undefined }, 'prop');
        break;
      case 'wavelength': {
        const b = this.bind(folder, spec.key, { min: VISIBLE_MIN, max: VISIBLE_MAX, step: 1, label: `${spec.label} (nm)` }, 'prop');
        b.element.append(spectrumBar(() => this.model[spec.key] as number));
        break;
      }
    }
  }

  private queueRefresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    requestAnimationFrame(() => {
      this.refreshQueued = false;
      const el = this.store.get(this.boundId);
      if (!this.pane || !el) return;
      const def = getDef(el.type) as ElementDef;
      this.syncing = true;
      Object.assign(this.model, this.toModel(el));
      if (def.info) Object.assign(this.info, def.info(el.props));
      this.pane.refresh();
      this.syncing = false;
      this.elementHost.querySelectorAll<HTMLElement>('.spectrum-bar').forEach((bar) => bar.dispatchEvent(new Event('sync')));
    });
  }

  private wireCard(from: { el: string; port: string }, to: { el: string; port: string }, id: string): HTMLElement {
    const name = (end: { el: string; port: string }) => {
      const el = this.store.get(end.el);
      return `${(el && getDef(el.type)?.label) ?? '?'} · ${end.port}`;
    };
    const d = document.createElement('div');
    d.className = 'empty-state';
    d.innerHTML = `<h3>Wire</h3><p>${name(from)} → ${name(to)}</p>`;
    const b = document.createElement('button');
    b.className = 'btn danger';
    b.textContent = 'Delete wire (Del)';
    b.onclick = () => this.store.removeWire(id);
    d.append(b);
    return d;
  }

  private emptyState(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'empty-state';
    d.innerHTML = `
      <h3>Nothing selected</h3>
      <p>Click a piece on the board to edit it, or add one from the left.</p>
      <ul class="keys">
        <li><kbd>Drag</kbd> move · <kbd>Shift</kbd> free placement</li>
        <li><kbd>Q</kbd>/<kbd>E</kbd> rotate · drag the round knob</li>
        <li>Drag the ◆ handles to reshape</li>
        <li><kbd>Space</kbd> / double-click toggles lasers</li>
        <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Del</kbd> delete</li>
        <li>Drag from a port ● to another port ○ to wire it</li>
        <li>Click a wire, then <kbd>Del</kbd> to remove it</li>
        <li>Click switches/buttons to operate them</li>
        <li>Wheel zoom · drag empty space to pan</li>
      </ul>`;
    return d;
  }

  private buildSettings(host: HTMLElement, onFit: () => void): void {
    const pane = new Pane({ container: host, title: 'Settings', expanded: false });
    const model = { ...settings };
    const on = <K extends keyof typeof settings>(key: K, opts: Record<string, unknown>) =>
      pane.addBinding(model, key, opts).on('change', (ev) => setSetting(key, ev.value as (typeof settings)[K]));
    on('snap', { label: 'Snap to grid' });
    on('bloom', { label: 'Glow', min: 0, max: 2.5, step: 0.05 });
    on('fresnel', { label: 'Glass reflections' });
    on('grid', { label: 'Grid' });
    on('particles', { label: 'Particles' });
    on('simRate', { label: 'Sim speed (Hz)', min: 1, max: 60, step: 1 });
    pane.addButton({ title: 'Fit board to view' }).on('click', onFit);
  }
}

/** Small rainbow strip with a marker showing the chosen wavelength. */
function spectrumBar(get: () => number): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'spectrum-bar';
  const stops = [];
  for (let nm = VISIBLE_MIN; nm <= VISIBLE_MAX; nm += 20) {
    const [r, g, b] = wavelengthToRgb(nm);
    stops.push(`rgb(${r * 255},${g * 255},${b * 255}) ${((nm - VISIBLE_MIN) / (VISIBLE_MAX - VISIBLE_MIN)) * 100}%`);
  }
  bar.style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  const marker = document.createElement('div');
  marker.className = 'spectrum-marker';
  bar.append(marker);
  const sync = () => {
    marker.style.left = `${((get() - VISIBLE_MIN) / (VISIBLE_MAX - VISIBLE_MIN)) * 100}%`;
  };
  bar.addEventListener('sync', sync);
  sync();
  return bar;
}
