import type { Category, ElementDef } from './types';

/**
 * Every module in src/elements is loaded automatically and registered by its
 * default export. Adding a new element type = adding one file there.
 */
const modules = import.meta.glob<{ default: ElementDef }>('../elements/*.ts', { eager: true });

const defs = new Map<string, ElementDef>();
for (const [path, mod] of Object.entries(modules)) {
  const def = mod.default;
  if (!def?.type) {
    console.warn(`[registry] ${path} has no default ElementDef export`);
    continue;
  }
  if (defs.has(def.type)) console.warn(`[registry] duplicate element type "${def.type}" in ${path}`);
  defs.set(def.type, def);
}

export const CATEGORY_ORDER: Category[] = ['source', 'optic', 'photonics', 'io', 'logic', 'obstacle', 'goal', 'field', 'note'];
export const CATEGORY_LABEL: Record<Category, string> = {
  source: 'Light sources',
  optic: 'Optics',
  photonics: 'Photonics',
  io: 'Signals & I/O',
  logic: 'Logic',
  obstacle: 'Obstacles',
  goal: 'Targets',
  field: 'Space-time',
  note: 'Annotations',
};

export function getDef(type: string): ElementDef | undefined {
  return defs.get(type);
}

export function allDefs(): ElementDef[] {
  return [...defs.values()].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      (a.order ?? 0) - (b.order ?? 0) ||
      a.label.localeCompare(b.label),
  );
}
