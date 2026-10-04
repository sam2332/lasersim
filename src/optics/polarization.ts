/**
 * Polarization as a normalized Jones vector (complex Ex, Ey) in a fixed lab
 * frame. Mirrors leave it unchanged, so a double pass through a quarter-wave
 * plate acts like a half-wave plate — the trick pancake lenses and optical
 * isolators rely on. Angles are radians; 0 = "p"/horizontal axis.
 */
export interface Jones {
  xr: number;
  xi: number;
  yr: number;
  yi: number;
}

export function linear(theta: number): Jones {
  return { xr: Math.cos(theta), xi: 0, yr: Math.sin(theta), yi: 0 };
}

/** Fraction of power along the linear axis `theta` (Malus's law for any state). */
export function fractionAlong(j: Jones | null, theta: number): number {
  if (!j) return 0.5;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const re = j.xr * c + j.yr * s;
  const im = j.xi * c + j.yi * s;
  return re * re + im * im;
}

/** Wave plate with fast axis `theta` and retardance `delta` (π = half-wave, π/2 = quarter-wave). */
export function retard(j: Jones | null, theta: number, delta: number): Jones | null {
  if (!j) return null;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // Rotate into the plate frame.
  let fr = j.xr * c + j.yr * s;
  let fi = j.xi * c + j.yi * s;
  let sr = -j.xr * s + j.yr * c;
  let si = -j.xi * s + j.yi * c;
  // Delay the slow axis.
  const cd = Math.cos(delta);
  const sd = Math.sin(delta);
  [sr, si] = [sr * cd - si * sd, sr * sd + si * cd];
  // Back to the lab frame.
  const out = { xr: fr * c - sr * s, xi: fi * c - si * s, yr: fr * s + sr * c, yi: fi * s + si * c };
  return normalize(out);
}

/** Rotate the polarization state (Faraday rotator). */
export function rotateState(j: Jones | null, angle: number): Jones | null {
  if (!j) return null;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { xr: j.xr * c - j.yr * s, xi: j.xi * c - j.yi * s, yr: j.xr * s + j.yr * c, yi: j.xi * s + j.yi * c };
}

function normalize(j: Jones): Jones {
  const n = Math.sqrt(j.xr * j.xr + j.xi * j.xi + j.yr * j.yr + j.yi * j.yi) || 1;
  return { xr: j.xr / n, xi: j.xi / n, yr: j.yr / n, yi: j.yi / n };
}

/** Human-readable description, e.g. "linear 45°" or "circular (R)". */
export function describe(j: Jones | null): string {
  if (!j) return 'unpolarized';
  // Stokes parameters.
  const s1 = j.xr * j.xr + j.xi * j.xi - (j.yr * j.yr + j.yi * j.yi);
  const s2 = 2 * (j.xr * j.yr + j.xi * j.yi);
  const s3 = 2 * (j.xr * j.yi - j.xi * j.yr);
  if (Math.abs(s3) > 0.97) return `circular (${s3 > 0 ? 'L' : 'R'})`;
  const angle = ((Math.atan2(s2, s1) / 2) * 180) / Math.PI;
  const a = Math.round((angle + 180) % 180);
  return Math.abs(s3) < 0.05 ? `linear ${a}°` : `elliptical ~${a}°`;
}
