import { Download, FolderOpen, Link, Maximize, Redo2, Trash, Undo2 } from 'lucide';
import { clearHash, downloadScene, pickSceneFile, shareUrl } from '../core/persistence';
import type { Store } from '../core/store';
import { presets } from '../presets';
import { iconButton } from './icons';
import { toast } from './toast';

export function mountTopbar(host: HTMLElement, store: Store, onFit: () => void): void {
  host.innerHTML = '';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = '<span class="brand-mark"></span><span class="brand-name">LaserSim</span>';

  const select = document.createElement('select');
  select.className = 'preset-select';
  select.title = 'Load a preset board';
  select.innerHTML = `<option value="" disabled selected>Load preset…</option>` + presets.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  select.addEventListener('change', () => {
    const p = presets.find((x) => x.id === select.value);
    select.value = '';
    if (!p) return;
    store.load(p.build());
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
    spacer,
    iconButton(Maximize, 'Fit board to view', onFit),
    sep(),
    iconButton(FolderOpen, 'Open a scene file', async () => {
      const scene = await pickSceneFile();
      if (scene) {
        store.load(scene);
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
      store.load({ ...store.scene, elements: [] });
      clearHash();
      toast('Board cleared — Ctrl+Z to undo');
    }),
  );
}
