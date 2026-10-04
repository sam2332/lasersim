import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { Check, RotateCcw, Trash, X } from 'lucide';
import { bus } from '../core/bus';
import type { Store } from '../core/store';
import { scriptHost } from '../scripting/host';
import { API_HELP, TEMPLATES } from '../scripting/templates';
import { iconButton } from './icons';
import { toast } from './toast';

/** Bottom drawer with a code editor and console for one microcontroller. */
export class ScriptEditor {
  private readonly root = document.createElement('section');
  private readonly title = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly consoleEl = document.createElement('div');
  private readonly editorHost = document.createElement('div');
  private readonly templates = document.createElement('select');
  private view: EditorView | null = null;
  private id: string | null = null;
  private applied = '';
  private consoleQueued = false;

  constructor(
    host: HTMLElement,
    private readonly store: Store,
  ) {
    this.root.className = 'script-drawer';
    this.root.hidden = true;

    const header = document.createElement('header');
    this.title.className = 'script-title';
    this.status.className = 'script-status';
    this.templates.className = 'preset-select';
    this.templates.title = 'Replace the code with a starter program';
    this.templates.innerHTML = `<option value="" disabled selected>Templates…</option>` + TEMPLATES.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
    this.templates.addEventListener('change', () => this.useTemplate(this.templates.value));
    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    header.append(
      this.title,
      this.status,
      spacer,
      this.templates,
      iconButton(RotateCcw, 'Revert to the applied code', () => this.setDoc(this.applied)),
      iconButton(Check, 'Apply (Ctrl+S)', () => this.apply(), 'Apply'),
      iconButton(X, 'Close', () => this.close()),
    );

    const body = document.createElement('div');
    body.className = 'script-body';
    this.editorHost.className = 'script-code';
    const side = document.createElement('div');
    side.className = 'script-side';
    const consoleHeader = document.createElement('div');
    consoleHeader.className = 'script-console-header';
    consoleHeader.append(Object.assign(document.createElement('span'), { textContent: 'Console' }), iconButton(Trash, 'Clear console', () => this.id && scriptHost.clearLog(this.id)));
    this.consoleEl.className = 'script-console';
    const help = document.createElement('pre');
    help.className = 'script-help';
    help.textContent = API_HELP.replace(/^\/\/ ?/gm, '');
    side.append(consoleHeader, this.consoleEl, help);
    body.append(this.editorHost, side);
    this.root.append(header, body);
    host.append(this.root);

    bus.on('edit-script', (id) => this.open(id));
    scriptHost.events.on('log', (id) => id === this.id && this.queueConsole());
    scriptHost.events.on('status', () => this.renderStatus());
    store.events.on('change', () => {
      if (this.id && !this.store.get(this.id)) this.close();
      else this.renderTitle();
    });
  }

  open(id: string): void {
    const el = this.store.get(id);
    if (!el || el.type !== 'mcu') return;
    this.id = id;
    this.applied = String(el.props.code ?? '');
    this.root.hidden = false;
    this.view?.destroy();
    this.view = new EditorView({
      parent: this.editorHost,
      state: EditorState.create({
        doc: this.applied,
        extensions: [
          basicSetup,
          javascript(),
          oneDark,
          keymap.of([
            { key: 'Mod-s', preventDefault: true, run: () => (this.apply(), true) },
            { key: 'Mod-Enter', run: () => (this.apply(), true) },
          ]),
          EditorView.updateListener.of((u) => u.docChanged && this.renderStatus()),
          EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace", fontSize: '12.5px' } }),
        ],
      }),
    });
    this.renderTitle();
    this.renderStatus();
    this.renderConsole();
    this.view.focus();
  }

  close(): void {
    this.view?.destroy();
    this.view = null;
    this.id = null;
    this.root.hidden = true;
  }

  private get doc(): string {
    return this.view?.state.doc.toString() ?? '';
  }

  private setDoc(code: string): void {
    this.view?.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: code } });
  }

  private apply(): void {
    if (!this.id) return;
    this.applied = this.doc;
    this.store.updateProps(this.id, { code: this.applied });
    scriptHost.clearLog(this.id);
    this.renderStatus();
    toast('Code applied — chip restarted', 'success');
  }

  private useTemplate(templateId: string): void {
    this.templates.value = '';
    const t = TEMPLATES.find((x) => x.id === templateId);
    if (!t || !this.id) return;
    if (this.doc !== this.applied && !window.confirm('Replace your unsaved code with this template?')) return;
    this.setDoc(t.code);
    this.store.updateProps(this.id, { inputs: t.inputs, outputs: t.outputs });
    this.apply();
  }

  private renderTitle(): void {
    const el = this.id ? this.store.get(this.id) : undefined;
    if (!el) return;
    this.title.textContent = `${el.props.name || 'CHIP'} · ${el.props.inputs} in / ${el.props.outputs} out`;
  }

  private renderStatus(): void {
    if (!this.id) return;
    const dirty = this.doc !== this.applied;
    const s = scriptHost.status(this.id);
    const label = dirty ? 'unsaved changes' : s === 'error' ? 'halted — error' : s === 'loading' ? 'loading engine…' : s === 'running' ? 'running' : 'waiting for simulation';
    this.status.textContent = label;
    this.status.dataset.state = dirty ? 'dirty' : s;
  }

  private queueConsole(): void {
    if (this.consoleQueued) return;
    this.consoleQueued = true;
    requestAnimationFrame(() => {
      this.consoleQueued = false;
      this.renderConsole();
    });
  }

  private renderConsole(): void {
    if (!this.id) return;
    const lines = scriptHost.logLines(this.id);
    const atBottom = this.consoleEl.scrollTop + this.consoleEl.clientHeight >= this.consoleEl.scrollHeight - 4;
    this.consoleEl.replaceChildren(
      ...lines.map((l) => {
        const div = document.createElement('div');
        div.textContent = l;
        if (l.startsWith('✖')) div.className = 'err';
        else if (l.startsWith('▶') || l.startsWith('■')) div.className = 'sys';
        return div;
      }),
    );
    if (atBottom) this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    this.renderStatus();
  }
}
