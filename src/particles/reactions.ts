import { KJ_PER_MOL_TO_K, SPECIES, speciesIndex } from './species';

/**
 * Elementary combustion reactions, fired by molecular collisions.
 *
 * A pair reacts when it collides head-on with more energy along the line of
 * centres than the activation energy Ea — so rates follow Arrhenius behaviour
 * on their own. Heats of reaction come from standard heats of formation, so a
 * flame's temperature rise is real chemistry, not a tuned number.
 *
 * Hydrogen–oxygen: the classic radical chain (initiation, propagation, the
 * branching step H + O₂ → OH + O that makes it explosive, and three-body
 * recombination). Methane: a reduced mechanism CH₄ → CH₃ → CH₂O → CO → CO₂.
 * Ea values are textbook-order estimates (kJ/mol).
 */
export interface Reaction {
  name: string;
  a: number;
  b: number;
  /** One product = three-body recombination (needs a nearby molecule to carry the energy away). */
  products: [number] | [number, number];
  /** Activation energy, K per molecule. */
  ea: number;
  /** Heat of reaction ΔH, K per molecule (negative = releases heat). */
  dh: number;
}

const s = speciesIndex;

function reaction(name: string, a: string, b: string, products: string[], eaKj: number): Reaction {
  const ia = s(a);
  const ib = s(b);
  const ps = products.map(s);
  const hf = (i: number) => SPECIES[i].hf;
  const dhKj = ps.reduce((t, i) => t + hf(i), 0) - hf(ia) - hf(ib);
  // An endothermic step can never need less than its own ΔH.
  const ea = Math.max(eaKj, dhKj, 0) * KJ_PER_MOL_TO_K;
  return { name, a: ia, b: ib, products: ps as [number] | [number, number], ea, dh: dhKj * KJ_PER_MOL_TO_K };
}

export const REACTIONS: Reaction[] = [
  // Hydrogen–oxygen chain.
  reaction('H₂ + O₂ → OH + OH (initiation)', 'h2', 'o2', ['oh', 'oh'], 170),
  reaction('OH + H₂ → H₂O + H', 'oh', 'h2', ['h2o', 'h'], 15),
  reaction('H + O₂ → OH + O (branching)', 'h', 'o2', ['oh', 'o'], 70),
  reaction('O + H₂ → OH + H (branching)', 'o', 'h2', ['oh', 'h'], 33),
  reaction('H + OH + M → H₂O + M', 'h', 'oh', ['h2o'], 0),
  reaction('H + H + M → H₂ + M', 'h', 'h', ['h2'], 0),
  reaction('O + O + M → O₂ + M', 'o', 'o', ['o2'], 0),
  // Methane (reduced).
  reaction('CH₄ + OH → CH₃ + H₂O', 'ch4', 'oh', ['ch3', 'h2o'], 15),
  reaction('CH₄ + O → CH₃ + OH', 'ch4', 'o', ['ch3', 'oh'], 36),
  reaction('CH₄ + H → CH₃ + H₂', 'ch4', 'h', ['ch3', 'h2'], 50),
  reaction('CH₃ + O₂ → CH₂O + OH', 'ch3', 'o2', ['ch2o', 'oh'], 38),
  reaction('CH₂O + O → CO + H₂O (lumped)', 'ch2o', 'o', ['co', 'h2o'], 20),
  reaction('CH₂O + OH → HCO + H₂O', 'ch2o', 'oh', ['hco', 'h2o'], 2),
  reaction('CH₂O + H → HCO + H₂', 'ch2o', 'h', ['hco', 'h2'], 18),
  reaction('HCO + OH → CO + H₂O', 'hco', 'oh', ['co', 'h2o'], 0),
  reaction('HCO + H → CO + H₂', 'hco', 'h', ['co', 'h2'], 0),
  reaction('CO + OH → CO₂ + H', 'co', 'oh', ['co2', 'h'], 4),
];

/** REACTION_TABLE[a * NS + b] = reaction index or -1 (symmetric). */
export const NS_REACT = SPECIES.length;
export const REACTION_TABLE = new Int16Array(NS_REACT * NS_REACT).fill(-1);
REACTIONS.forEach((r, i) => {
  REACTION_TABLE[r.a * NS_REACT + r.b] = i;
  REACTION_TABLE[r.b * NS_REACT + r.a] = i;
});

/**
 * What an electric spark does to a molecule: the plasma breaks bonds, leaving
 * radicals. Mass is conserved (e.g. O₂ → O + O).
 */
export const SPARK_DISSOCIATION: Record<number, [number, number]> = {
  [s('o2')]: [s('o'), s('o')],
  [s('h2')]: [s('h'), s('h')],
  [s('ch4')]: [s('ch3'), s('h')],
  [s('h2o')]: [s('oh'), s('h')],
  [s('co2')]: [s('co'), s('o')],
};
