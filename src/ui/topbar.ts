import { Download, FolderOpen, Link, Maximize, Pause, Play, Redo2, RotateCcw, StepForward, Trash, Undo2 } from 'lucide';
import { clearHash, downloadScene, pickSceneFile, shareUrl } from '../core/persistence';
import { setSetting, settings, settingsEvents } from '../core/settings';
import type { Store } from '../core/store';
import { PRESET_GROUPS, presets } from '../presets';
import { icon, iconButton } from './icons';
import { toast } from './toast';

export interface SimControls {
  step(): void;
  reset(): void;
}

export function mountTopbar(host: HTMLElement, store: Store, onFit: () => void, sim: SimControls): void {
  host.innerHTML = '';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = '<span class="brand-mark"></span><span class="brand-name">LaserSim</span>';

  const select = document.createElement('select');
  select.className = 'preset-select';
  select.title = 'Load a preset board';
  select.innerHTML =
    `<option value="" disabled selected>Load example…</option>` +
    PRESET_GROUPS.map((g) => {
      const items = presets.filter((p) => p.group === g);
      return items.length ? `<optgroup label="${g}">${items.map((p) => `<option value="${p.id}">${p.name}</option>`).join('')}</optgroup>` : '';
    }).join('');
  select.addEventListener('change', () => {
    const p = presets.find((x) => x.id === select.value);
    select.value = '';
    if (!p) return;
    store.load(p.build());
    sim.reset();
    onFit();
    toast(`Loaded “${p.name}”`);
  });

  const undo = iconButton(Undo2, 'Undo (Ctrl+Z)', () => store.undo());
  const redo = iconButton(Redo2, 'Redo (Ctrl+Shift+Z)', () => store.redo());
  const sync = () => {
    undo.disabled = !store.canUndo;
    redo.disabled = !store.canRedo;
  };
  store.events.on('commit', sync);
  store.events.on('change', sync);
  sync();

  // Simulation transport.
  const play = iconButton(Pause, 'Pause simulation', () => setSetting('paused', !settings.paused));
  const stepBtn = iconButton(StepForward, 'Single step (while paused)', () => sim.step());
  const rate = document.createElement('span');
  rate.className = 'sim-rate';
  const syncSim = () => {
    play.replaceChildren(icon(settings.paused ? Play : Pause));
    play.title = settings.paused ? 'Run simulation' : 'Pause simulation';
    play.classList.toggle('active', settings.paused);
    stepBtn.disabled = !settings.paused;
    rate.textContent = settings.paused ? 'paused' : `${settings.simRate} Hz`;
  };
  settingsEvents.on('change', syncSim);
  syncSim();

  const spacer = document.createElement('div');
  spacer.className = 'spacer';

  const sep = () => {
    const s = document.createElement('div');
    s.className = 'sep';
    return s;
  };

  host.append(
    brand,
    select,
    sep(),
    undo,
    redo,
    sep(),
    play,
    stepBtn,
    iconButton(RotateCcw, 'Reset simulation state (latches, counters, clocks)', () => {
      sim.reset();
      toast('Simulation reset');
    }),
    rate,
    spacer,
    iconButton(Maximize, 'Fit board to view', onFit),
    sep(),
    iconButton(FolderOpen, 'Open a scene file', async () => {
      const scene = await pickSceneFile();
      if (scene) {
        store.load(scene);
        sim.reset();
        onFit();
        toast('Scene loaded');
      }
    }),
    iconButton(Download, 'Download scene as JSON', () => downloadScene(store.scene)),
    iconButton(
      Link,
      'Copy a shareable link',
      async () => {
        const url = shareUrl(store.scene);
        try {
          await navigator.clipboard.writeText(url);
          toast('Share link copied to clipboard', 'success');
        } catch {
          window.prompt('Copy this link:', url);
        }
      },
      'Share',
    ),
    sep(),
    iconButton(Trash, 'Clear the board', () => {
      if (!store.scene.elements.length) return;
      store.load({ ...store.scene, elements: [], wires: [] });
      clearHash();
      toast('Board cleared — Ctrl+Z to undo');
    }),
  );
}
