import { getDef } from '../core/registry';
import type { Store } from '../core/store';
import type { Port, SceneElement, Signals } from '../core/types';
import type { Editor, PortRef } from '../editor/editor';
import { findPort, portWorld } from '../logic/ports';
import type { Stage } from '../render/stage';

/** Readable names for common port ids when an element doesn't label its ports. */
const FALLBACK: Record<string, string> = {
  out: 'output',
  in: 'input',
  en: 'enable',
  ctrl: 'control',
};

export function portName(port: Port): string {
  return port.label ?? FALLBACK[port.id] ?? port.id;
}

function elementName(el: SceneElement): string {
  const label = getDef(el.type)?.label ?? el.type;
  const name = typeof el.props.name === 'string' && el.props.name ? ` “${el.props.name}”` : '';
  return label + name;
}

/** Hover tooltip for wiring ports: what the pin is, its live state and what it's wired to. */
export class PortTooltip {
  private readonly tip = document.createElement('div');
  private current: PortRef | null = null;
  private timer = 0;

  constructor(
    host: HTMLElement,
    private readonly stage: Stage,
    private readonly store: Store,
    editor: Editor,
    private readonly signals: () => Map<string, Signals>,
  ) {
    this.tip.className = 'port-tip';
    this.tip.hidden = true;
    host.append(this.tip);
    editor.events.on('port-hover', (ref) => this.show(ref));
  }

  private show(ref: PortRef | null): void {
    this.current = ref;
    clearInterval(this.timer);
    if (!ref) {
      this.tip.hidden = true;
      return;
    }
    this.render();
    this.tip.hidden = false;
    // Keep the state and position live while hovering (signals change, view may pan).
    this.timer = window.setInterval(() => this.render(), 150);
  }

  private render(): void {
    const ref = this.current;
    const el = ref && this.store.get(ref.el.id);
    const port = el && ref && findPort(el, ref.port.id);
    if (!el || !port) {
      this.tip.hidden = true;
      return;
    }
    const sig = this.signals().get(el.id);
    const on = port.dir === 'out' ? !!sig?.outputs[port.id] : !!sig?.inputs[port.id];
    const wires = this.store.scene.wires.filter((w) => (port.dir === 'out' ? w.from.el === el.id && w.from.port === port.id : w.to.el === el.id && w.to.port === port.id));
    const links = wires.map((w) => {
      const other = this.store.get(port.dir === 'out' ? w.to.el : w.from.el);
      const otherPort = other && findPort(other, port.dir === 'out' ? w.to.port : w.from.port);
      return other && otherPort ? `${port.dir === 'out' ? '→' : '←'} ${elementName(other)} · ${portName(otherPort)}` : '';
    });
    const unwired = port.dir === 'in' ? 'not wired — uses its default' : 'not wired';

    this.tip.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'port-tip-head';
    head.textContent = `${elementName(el)} · ${portName(port)}`;
    const meta = document.createElement('div');
    meta.className = 'port-tip-meta';
    const state = document.createElement('span');
    state.className = on ? 'on' : 'off';
    state.textContent = on ? 'ON' : 'OFF';
    meta.append(`${port.dir === 'in' ? 'Input' : 'Output'} · `, state);
    const list = document.createElement('div');
    list.className = 'port-tip-links';
    list.textContent = links.filter(Boolean).slice(0, 4).join('\n') + (links.length > 4 ? `\n+${links.length - 4} more` : '') || unwired;
    const hint = document.createElement('div');
    hint.className = 'port-tip-hint';
    hint.textContent = port.dir === 'out' ? 'Drag to an input to wire' : wires.length ? 'Drag to move or remove the wire' : 'Drag to an output to wire';
    this.tip.append(head, meta, list, hint);

    const w = portWorld(el, port);
    const s = this.stage.viewport.toScreen(w.x, w.y);
    this.tip.style.left = `${s.x + 14}px`;
    this.tip.style.top = `${s.y + 14}px`;
  }
}
