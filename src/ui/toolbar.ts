import { allDefs, CATEGORY_LABEL } from '../core/registry';
import type { Category, Props } from '../core/types';
import type { Editor } from '../editor/editor';
import { icon } from './icons';

const DRAG_MIME = 'application/x-lasersim-element';

/** Palette built entirely from the element registry (new element files appear here automatically). */
export function mountToolbar(host: HTMLElement, stageHost: HTMLElement, editor: Editor): void {
  host.innerHTML = '';
  let current: Category | null = null;

  for (const def of allDefs()) {
    if (def.category !== current) {
      current = def.category;
      const h = document.createElement('div');
      h.className = 'tool-group';
      h.textContent = CATEGORY_LABEL[def.category];
      host.append(h);
    }
    const entries = def.variants?.length ? def.variants : [{ label: def.label, icon: def.icon, props: {} }];
    for (const v of entries) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.title = def.description ? `${v.label} — ${def.description}` : v.label;
      b.draggable = true;
      b.append(icon(v.icon ?? def.icon, 18));
      const span = document.createElement('span');
      span.textContent = v.label;
      b.append(span);
      b.addEventListener('click', () => editor.place(def.type, v.props as Props));
      b.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData(DRAG_MIME, JSON.stringify({ type: def.type, props: v.props }));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
      });
      host.append(b);
    }
  }

  stageHost.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  stageHost.addEventListener('drop', (e) => {
    const raw = e.dataTransfer?.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();
    const { type, props } = JSON.parse(raw) as { type: string; props: Props };
    editor.place(type, props, editor.screenToWorld(e.clientX, e.clientY));
  });
}
