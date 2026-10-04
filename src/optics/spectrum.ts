export const VISIBLE_MIN = 380;
export const VISIBLE_MAX = 700;

/** Approximate sRGB colour of a pure wavelength (Dan Bruton's piecewise fit), channels 0–1. */
export function wavelengthToRgb(nm: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
  } else if (nm <= 780) {
    r = 1;
  }
  // Keep the deep violet end visible instead of fading to black.
  const edge = nm < 420 ? 0.55 + (0.45 * (nm - 380)) / 40 : 1;
  const gamma = 0.8;
  return [Math.pow(r * edge, gamma), Math.pow(g * edge, gamma), Math.pow(b * edge, gamma)];
}

const toHex = ([r, g, b]: [number, number, number]): number =>
  (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);

const cache = new Map<number, number>();

/** Pixi colour for a wavelength. */
export function beamColor(nm: number): number {
  const key = Math.round(nm);
  let c = cache.get(key);
  if (c === undefined) {
    c = toHex(wavelengthToRgb(key));
    cache.set(key, c);
  }
  return c;
}

/** Blend a colour toward white (used for hot beam cores). */
export function lighten(color: number, amount: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const m = (v: number) => Math.round(v + (255 - v) * amount);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

/** Evenly spaced wavelengths across the visible band, red first. */
export function spectrumSamples(count: number): number[] {
  if (count <= 1) return [550];
  const hi = 680;
  const lo = 410;
  return Array.from({ length: count }, (_, i) => hi - ((hi - lo) * i) / (count - 1));
}

/**
 * Cauchy dispersion: n(λ) = A + B/λ² (λ in µm).
 * `dispersion` scales B so the rainbow spread can be exaggerated for play.
 */
export function cauchy(ior: number, dispersion: number): (nm: number) => number {
  const B = 0.008 * dispersion;
  // Shift A so `ior` is the index at 550 nm.
  const A = ior - B / (0.55 * 0.55);
  return (nm) => {
    const um = nm / 1000;
    return A + B / (um * um);
  };
}
