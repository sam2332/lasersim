import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { sanitizeScene } from './store';
import type { Scene } from './types';

const AUTOSAVE_KEY = 'lasersim.autosave';
const HASH_PREFIX = '#scene=';

export function saveLocal(scene: Scene): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(scene));
  } catch {
    /* storage unavailable */
  }
}

export function loadLocal(): Scene | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? sanitizeScene(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function shareUrl(scene: Scene): string {
  const url = new URL(window.location.href);
  url.hash = HASH_PREFIX + compressToEncodedURIComponent(JSON.stringify(scene));
  return url.toString();
}

export function loadFromHash(): Scene | null {
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const json = decompressFromEncodedURIComponent(hash.slice(HASH_PREFIX.length));
    return json ? sanitizeScene(JSON.parse(json)) : null;
  } catch {
    return null;
  }
}

export function clearHash(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function downloadScene(scene: Scene, name = 'lasersim-scene.json'): void {
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function pickSceneFile(): Promise<Scene | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(sanitizeScene(JSON.parse(await file.text())));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
