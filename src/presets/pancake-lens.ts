import type { Preset } from './index';
import { el, scene } from './helpers';

/**
 * VR "pancake" lens vs a classic lens with the same job (collimating a display
 * pixel so the eye sees it at infinity).
 *
 * Pancake path: pixel → polarizer 45° → λ/4 (circular) → curved 50% mirror →
 * λ/4 (now linear 135°) → reflective polarizer (pass 45°) REFLECTS it → λ/4 →
 * curved mirror reflects + focuses → λ/4 (now linear 45°) → reflective
 * polarizer PASSES it. The light crosses the gap three times, so the optics
 * are a fraction of the length — at the cost of ~1/8 of the light.
 */
const preset: Preset = {
  id: 'pancake-lens',
  name: 'VR Pancake Lens',
  group: 'Photonics',
  order: 11,
  build: () => {
    const top = 300;
    const bot = 780;
    // Classic: pixel at the focal plane of a convex lens (f ≈ 300).
    const classic = [
      el('point-source', 200, top, 0, { rays: 11, fan: 20, wavelength: 560, power: 1 }),
      el('lens', 500, top, 0, { height: 240, left: 24, right: 24, thickness: 6, dispersion: 0 }),
      // Eye: a small lens focusing parallel light onto the retina.
      el('lens', 1460, top, 0, { height: 200, left: 24, right: 24, thickness: 4, dispersion: 0 }),
      el('target', 1675, top, 0, { radius: 10, threshold: 0.5 }),
    ];
    // Pancake: same pixel, folded optics only ~150px long.
    const pancake = [
      el('point-source', 200, bot, 0, { rays: 11, fan: 20, wavelength: 560, power: 2.5 }),
      el('polarizer', 228, bot, 0, { axis: 45, length: 90 }),
      el('waveplate', 252, bot, 0, { kind: 'quarter', axis: 0, length: 140 }),
      el('curved-mirror', 330, bot, 0, { height: 240, depth: 18, reflectivity: 0.5 }),
      el('waveplate', 352, bot, 0, { kind: 'quarter', axis: 0, length: 240 }),
      el('reflective-polarizer', 372, bot, 0, { axis: 45, length: 240 }),
      el('lens', 1460, bot, 0, { height: 200, left: 24, right: 24, thickness: 4, dispersion: 0 }),
      el('target', 1675, bot, 0, { radius: 10, threshold: 0.3 }),
    ];
    return scene([
      ...classic,
      ...pancake,
      el('label', 900, 90, 0, { text: 'Classic lens: the display must sit a full focal length (~300 px) away.', size: 17, width: 900, color: 0xf2f5fb }),
      el('label', 900, 560, 0, { text: 'Pancake lens: polarization folds the light path three times through the same gap.', size: 17, width: 900, color: 0xf2f5fb }),
      el('label', 330, 1000, 0, {
        text: 'pixel → polarizer 45° → λ/4 → curved half-mirror → λ/4 → reflective polarizer ↩ → λ/4 → half-mirror ↩ (focuses) → λ/4 → passes',
        size: 14,
        width: 620,
      }),
      el('label', 1550, 470, 0, { text: 'eye (lens + retina)', size: 14 }),
    ]);
  },
};

export default preset;
