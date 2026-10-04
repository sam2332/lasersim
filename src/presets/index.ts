import type { Scene } from '../core/types';

export type PresetGroup = 'Optics' | 'Photonics' | 'Logic & signals' | 'Sandbox';

export interface Preset {
  id: string;
  name: string;
  group: PresetGroup;
  order: number;
  build(): Scene;
}

/** Every other module in src/presets default-exports a Preset and is picked up automatically. */
const modules = import.meta.glob<{ default: Preset }>(['./*.ts', '!./index.ts', '!./helpers.ts'], { eager: true });

export const presets: Preset[] = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.order - b.order);

export const getPreset = (id: string) => presets.find((p) => p.id === id);

export const PRESET_GROUPS: PresetGroup[] = ['Optics', 'Photonics', 'Logic & signals', 'Sandbox'];
