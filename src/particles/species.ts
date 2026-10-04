/**
 * Particle species for the chamber simulation.
 *
 * Units used by the simulation: length in px, mass in amu, energy in kelvin
 * (k_B = 1), so velocity is px per "sim time unit" t0 = px·√(amu/K).
 *
 * σ comes from published Lennard-Jones fits (Å). ε is chosen so the 2D model's
 * phase behaviour lands near the real substance: 2D LJ has a triple point at
 * ≈0.41 ε and a critical point at ≈0.53 ε, so ε = √(T_triple/0.41 · T_crit/0.533)
 * matches both on average. Water is hand-tuned (LJ has no hydrogen bonds) so it
 * is liquid at room temperature.
 */
export interface Species {
  id: string;
  name: string;
  formula: string;
  /** amu */
  mass: number;
  /** Ångström */
  sigmaA: number;
  /** Effective well depth in K (2D-calibrated). */
  epsilon: number;
  color: number;
  /** Real-world reference temperatures, for the UI. */
  triple?: number;
  critical: number;
}

const eps = (triple: number, critical: number) => Math.sqrt((triple / 0.41) * (critical / 0.533));

export const SPECIES: Species[] = [
  { id: 'he', name: 'Helium', formula: 'He', mass: 4.0026, sigmaA: 2.56, epsilon: 10.2, color: 0xffb3d9, critical: 5.2 },
  { id: 'ne', name: 'Neon', formula: 'Ne', mass: 20.18, sigmaA: 2.75, epsilon: eps(24.6, 44.4), color: 0xff7043, triple: 24.6, critical: 44.4 },
  { id: 'ar', name: 'Argon', formula: 'Ar', mass: 39.95, sigmaA: 3.4, epsilon: eps(83.8, 150.7), color: 0xb48cff, triple: 83.8, critical: 150.7 },
  { id: 'kr', name: 'Krypton', formula: 'Kr', mass: 83.8, sigmaA: 3.6, epsilon: eps(115.8, 209.4), color: 0xd0e4ff, triple: 115.8, critical: 209.4 },
  { id: 'xe', name: 'Xenon', formula: 'Xe', mass: 131.3, sigmaA: 4.1, epsilon: eps(161.4, 289.7), color: 0x6fa8ff, triple: 161.4, critical: 289.7 },
  { id: 'n2', name: 'Nitrogen', formula: 'N₂', mass: 28.01, sigmaA: 3.7, epsilon: eps(63.2, 126.2), color: 0x8fd3ff, triple: 63.2, critical: 126.2 },
  { id: 'o2', name: 'Oxygen', formula: 'O₂', mass: 32.0, sigmaA: 3.46, epsilon: eps(54.4, 154.6), color: 0xff8a80, triple: 54.4, critical: 154.6 },
  { id: 'ch4', name: 'Methane', formula: 'CH₄', mass: 16.04, sigmaA: 3.76, epsilon: eps(90.7, 190.6), color: 0x9be37a, triple: 90.7, critical: 190.6 },
  { id: 'co2', name: 'Carbon dioxide', formula: 'CO₂', mass: 44.01, sigmaA: 3.94, epsilon: eps(216.6, 304.1), color: 0xb0b6c0, triple: 216.6, critical: 304.1 },
  { id: 'h2o', name: 'Water (approx.)', formula: 'H₂O', mass: 18.02, sigmaA: 2.8, epsilon: 640, color: 0x4fc3f7, triple: 273.2, critical: 647.1 },
];

/** Pixels per Ångström — sets how big molecules look on the board. */
export const PX_PER_A = 3;

export const speciesIndex = (id: string): number => Math.max(0, SPECIES.findIndex((s) => s.id === id));

export const sigmaPx = (s: Species): number => s.sigmaA * PX_PER_A;

/**
 * Converts 2D pressure (K/px², energy per area) to atmospheres by treating the
 * board as a slab one argon diameter thick.
 */
const KB = 1.380649e-23;
const PX_M = 1e-10 / PX_PER_A;
const SLAB_M = 3.4e-10;
export const pressureToAtm = (p2d: number): number => (p2d * KB) / (PX_M * PX_M * SLAB_M) / 101325;
