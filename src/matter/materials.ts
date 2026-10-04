/**
 * Macro-scale materials for the material field (Powder-Toy style sandbox).
 *
 * Values are real engineering data (SI): density kg/m³, specific heat J/(kg·K),
 * thermal conductivity W/(m·K), transition temperatures K, latent heats J/kg.
 * IDs are persisted in saved scenes — only ever APPEND new materials.
 */

export type Phase = 'empty' | 'solid' | 'powder' | 'liquid' | 'gas' | 'fire';
export type Optics = 'clear' | 'absorb' | 'reflect';

export interface Transition {
  /** Temperature, K. */
  at: number;
  /** Material key it turns into. */
  to: string;
  /** Latent heat, J/kg (0 = instant). */
  latent: number;
}

export interface Material {
  key: string;
  name: string;
  phase: Phase;
  density: number;
  cp: number;
  k: number;
  color: number;
  /** Per-cell brightness variation (0–1). */
  grain: number;
  melt?: Transition;
  freeze?: Transition;
  boil?: Transition;
  condense?: Transition;
  /** Burns in air above `at` K for `burnTime` s, releasing `heat` J/kg, leaving `ash`. */
  burn?: { at: number; burnTime: number; heat: number; ash: string };
  /** Detonates above `at` K, releasing `energy` J/kg as a pressure blast. */
  explosive?: { at: number; energy: number };
  /** Breaks into `to` when pressure exceeds `strength` Pa. */
  breaks?: { strength: number; to: string };
  optics: Optics;
  /** Gas/fire lifetime, s (then turns into `decay`). */
  lifetime?: number;
  decay?: string;
  /** Temperature a freshly drawn cell starts at (molten materials are hot). */
  spawnT?: number;
  /** How far a liquid spreads sideways per step (viscosity). */
  flow?: number;
  /** Category in the material picker. */
  group: 'Structures' | 'Metals' | 'Natural' | 'Liquids' | 'Gases & fire' | 'Hazards' | 'Molten';
}

const M = (m: Material) => m;

export const MATERIALS: Material[] = [
  M({ key: 'air', name: 'Air', phase: 'empty', density: 1.2, cp: 1005, k: 0.026, color: 0x000000, grain: 0, optics: 'clear', group: 'Gases & fire' }),
  M({ key: 'steel', name: 'Steel', phase: 'solid', density: 7850, cp: 490, k: 45, color: 0x8a94a6, grain: 0.08, melt: { at: 1723, to: 'molten-steel', latent: 2.7e5 }, breaks: { strength: 4e8, to: 'scrap' }, optics: 'reflect', group: 'Metals' }),
  M({ key: 'concrete', name: 'Concrete', phase: 'solid', density: 2400, cp: 880, k: 1.7, color: 0x9a968c, grain: 0.12, melt: { at: 1800, to: 'lava', latent: 4e5 }, breaks: { strength: 4e7, to: 'rubble' }, optics: 'absorb', group: 'Structures' }),
  M({ key: 'brick', name: 'Brick', phase: 'solid', density: 1900, cp: 840, k: 0.7, color: 0xa4553e, grain: 0.15, melt: { at: 1900, to: 'lava', latent: 4e5 }, breaks: { strength: 2e7, to: 'rubble' }, optics: 'absorb', group: 'Structures' }),
  M({ key: 'glass', name: 'Glass', phase: 'solid', density: 2500, cp: 840, k: 1.0, color: 0xbfe6ff, grain: 0.04, melt: { at: 1400, to: 'molten-glass', latent: 3e5 }, breaks: { strength: 5e6, to: 'shards' }, optics: 'clear', group: 'Structures' }),
  M({ key: 'copper', name: 'Copper', phase: 'solid', density: 8960, cp: 385, k: 400, color: 0xc8794a, grain: 0.07, melt: { at: 1358, to: 'molten-copper', latent: 2.05e5 }, breaks: { strength: 2e8, to: 'scrap' }, optics: 'reflect', group: 'Metals' }),
  M({ key: 'aluminium', name: 'Aluminium', phase: 'solid', density: 2700, cp: 900, k: 237, color: 0xc9cfd8, grain: 0.05, melt: { at: 933, to: 'molten-aluminium', latent: 3.97e5 }, breaks: { strength: 1e8, to: 'scrap' }, optics: 'reflect', group: 'Metals' }),
  M({ key: 'wood', name: 'Wood', phase: 'solid', density: 600, cp: 1700, k: 0.15, color: 0x8b5a2b, grain: 0.18, burn: { at: 573, burnTime: 90, heat: 1.6e7, ash: 'ash' }, breaks: { strength: 1e7, to: 'sawdust' }, optics: 'absorb', group: 'Natural' }),
  M({ key: 'sand', name: 'Sand', phase: 'powder', density: 1600, cp: 830, k: 0.3, color: 0xd8c18a, grain: 0.14, melt: { at: 1986, to: 'molten-glass', latent: 1.4e5 }, optics: 'absorb', group: 'Natural' }),
  M({ key: 'rubble', name: 'Rubble', phase: 'powder', density: 2000, cp: 880, k: 0.8, color: 0x7d7a72, grain: 0.22, melt: { at: 1800, to: 'lava', latent: 4e5 }, optics: 'absorb', group: 'Structures' }),
  M({ key: 'ash', name: 'Ash', phase: 'powder', density: 500, cp: 800, k: 0.1, color: 0x5a5856, grain: 0.15, optics: 'absorb', group: 'Natural' }),
  M({ key: 'water', name: 'Water', phase: 'liquid', density: 1000, cp: 4186, k: 0.6, color: 0x2f7fd6, grain: 0.05, freeze: { at: 273.15, to: 'ice', latent: 3.34e5 }, boil: { at: 373.15, to: 'steam', latent: 2.26e6 }, optics: 'clear', flow: 5, group: 'Liquids' }),
  M({ key: 'ice', name: 'Ice', phase: 'solid', density: 917, cp: 2100, k: 2.2, color: 0xcfeaff, grain: 0.05, melt: { at: 273.15, to: 'water', latent: 3.34e5 }, breaks: { strength: 5e6, to: 'snow' }, optics: 'clear', spawnT: 250, group: 'Natural' }),
  M({ key: 'steam', name: 'Steam', phase: 'gas', density: 0.6, cp: 2010, k: 0.025, color: 0xdfe8f0, grain: 0.1, condense: { at: 373.15, to: 'water', latent: 2.26e6 }, optics: 'clear', spawnT: 390, group: 'Gases & fire' }),
  M({ key: 'lava', name: 'Lava', phase: 'liquid', density: 2600, cp: 1000, k: 1.5, color: 0xff5a1a, grain: 0.15, freeze: { at: 1400, to: 'stone', latent: 4e5 }, optics: 'absorb', spawnT: 1700, flow: 1, group: 'Molten' }),
  M({ key: 'stone', name: 'Stone', phase: 'solid', density: 2700, cp: 840, k: 2.5, color: 0x4f4c4a, grain: 0.14, melt: { at: 1400, to: 'lava', latent: 4e5 }, breaks: { strength: 6e7, to: 'rubble' }, optics: 'absorb', group: 'Natural' }),
  M({ key: 'molten-steel', name: 'Molten steel', phase: 'liquid', density: 7000, cp: 820, k: 30, color: 0xffb347, grain: 0.06, freeze: { at: 1723, to: 'steel', latent: 2.7e5 }, optics: 'absorb', spawnT: 1900, flow: 3, group: 'Molten' }),
  M({ key: 'molten-glass', name: 'Molten glass', phase: 'liquid', density: 2400, cp: 1300, k: 1.5, color: 0xff8a3a, grain: 0.05, freeze: { at: 1400, to: 'glass', latent: 3e5 }, optics: 'absorb', spawnT: 1600, flow: 1, group: 'Molten' }),
  M({ key: 'molten-copper', name: 'Molten copper', phase: 'liquid', density: 8000, cp: 530, k: 160, color: 0xffa55a, grain: 0.05, freeze: { at: 1358, to: 'copper', latent: 2.05e5 }, optics: 'absorb', spawnT: 1500, flow: 3, group: 'Molten' }),
  M({ key: 'molten-aluminium', name: 'Molten aluminium', phase: 'liquid', density: 2375, cp: 1180, k: 90, color: 0xffc89a, grain: 0.05, freeze: { at: 933, to: 'aluminium', latent: 3.97e5 }, optics: 'reflect', spawnT: 1050, flow: 4, group: 'Molten' }),
  M({ key: 'fire', name: 'Fire', phase: 'fire', density: 0.3, cp: 1100, k: 0.08, color: 0xff7a1a, grain: 0.3, optics: 'clear', lifetime: 1.2, decay: 'smoke', spawnT: 1300, group: 'Gases & fire' }),
  M({ key: 'smoke', name: 'Smoke', phase: 'gas', density: 0.9, cp: 1005, k: 0.03, color: 0x3a3a3e, grain: 0.2, optics: 'absorb', lifetime: 14, decay: 'air', spawnT: 500, group: 'Gases & fire' }),
  M({ key: 'oil', name: 'Oil', phase: 'liquid', density: 880, cp: 2000, k: 0.15, color: 0x3a2a12, grain: 0.06, burn: { at: 520, burnTime: 40, heat: 4.2e7, ash: 'smoke' }, optics: 'absorb', flow: 4, group: 'Liquids' }),
  M({ key: 'shards', name: 'Glass shards', phase: 'powder', density: 1500, cp: 840, k: 0.5, color: 0xa8d4ee, grain: 0.2, melt: { at: 1400, to: 'molten-glass', latent: 3e5 }, optics: 'clear', group: 'Structures' }),
  M({ key: 'tnt', name: 'Explosive (TNT)', phase: 'solid', density: 1600, cp: 1400, k: 0.2, color: 0xc0392b, grain: 0.1, explosive: { at: 570, energy: 4.2e6 }, breaks: { strength: 2e6, to: 'tnt' }, optics: 'absorb', group: 'Hazards' }),
  M({ key: 'scrap', name: 'Metal scrap', phase: 'powder', density: 3000, cp: 490, k: 20, color: 0x6f7784, grain: 0.25, melt: { at: 1723, to: 'molten-steel', latent: 2.7e5 }, optics: 'reflect', group: 'Metals' }),
  M({ key: 'sawdust', name: 'Sawdust', phase: 'powder', density: 250, cp: 1700, k: 0.07, color: 0xb98b56, grain: 0.2, burn: { at: 500, burnTime: 15, heat: 1.6e7, ash: 'ash' }, optics: 'absorb', group: 'Natural' }),
  M({ key: 'snow', name: 'Snow', phase: 'powder', density: 300, cp: 2100, k: 0.2, color: 0xf2f6fa, grain: 0.06, melt: { at: 273.15, to: 'water', latent: 3.34e5 }, optics: 'absorb', spawnT: 260, group: 'Natural' }),
];

export const MAT_INDEX: Record<string, number> = Object.fromEntries(MATERIALS.map((m, i) => [m.key, i]));
export const AIR = 0;

/** Resolve transition targets to indices once. */
export const TO = (key: string): number => {
  const i = MAT_INDEX[key];
  if (i === undefined) throw new Error(`Unknown material "${key}"`);
  return i;
};

export const AMBIENT = 293;
